export type BillableGrouping = "entry" | "task" | "project"

export type BillableTimeEntryRow = {
  id: string
  clientId: string
  projectId: string
  projectName: string
  taskId: string | null
  taskTitle: string | null
  description: string
  durationSeconds: number
  hourlyRateSnapshotCents: number
  currency: string
}

// `rebillableCents` arrives already marked up, from features/expenses/services/expenseRebilling.ts's
// calculateRebillableCents. The markup rule stays in the module that owns the column, and this file
// never re-derives it: two implementations of one money rule is how the invoice and the expense list
// start disagreeing about what a client owes.
//
// `descriptionSuffix` is already translated for the same reason invoiceRenderData.ts takes a
// statusLabel — an ICU message with the markup percentage in it belongs to the caller, and this
// function stays exercisable without the i18n singleton.
export type BillableExpenseRow = {
  id: string
  clientId: string
  projectId: string | null
  description: string
  rebillableCents: number
  descriptionSuffix: string | null
  currency: string
}

export type BillableConversionInput = {
  timeEntries: BillableTimeEntryRow[]
  expenses: BillableExpenseRow[]
  grouping: BillableGrouping
  hourUnit: string
}

export type BillableLineDraft = {
  description: string
  unit: string | null
  quantity: number
  unitPriceCents: number
  sourceTimeEntryId: string | null
  sourceExpenseId: string | null
}

export type BillableConversionPlan =
  | { outcome: "currencyMismatch"; currencies: string[] }
  | { outcome: "clientMismatch" }
  | { outcome: "nothingBillable" }
  | {
      outcome: "billable"
      currency: string
      clientId: string
      projectId: string | null
      lines: BillableLineDraft[]
      timeEntryIds: string[]
      expenseIds: string[]
      unbillableTimeEntryIds: string[]
    }

const SECONDS_PER_HOUR = 3600

// `line_items.quantity` is numeric(10,2), so the hundredth of an hour is the finest unit that
// survives the write. Rounding coarser — to the quarter hour, say — is a billing policy nobody has
// agreed to here, and inventing one would move a client's total.
const HOURS_SCALE = 100

// Not imported from features/timeTracking: a pure service reaching a feature's client-safe barrel
// would drag that feature's component graph in and cost this file the millisecond test property
// ADR-0007 exists for. 3600 is a fact rather than a shared contract.
function toBilledHours(totalSeconds: number): number {
  return Math.round((totalSeconds / SECONDS_PER_HOUR) * HOURS_SCALE) / HOURS_SCALE
}

// Time is summed first and rounded once per line, never rounded per entry and then summed: a line
// carries exactly one quantity, so there is exactly one number to round, and rounding n times before
// adding would drift by up to n half-hundredths of an hour against the seconds actually worked.
//
// A group whose hours round to 0.00 cannot be written at all — `chk_line_items_quantity` requires
// `> 0` — so it is reported as unbillable rather than clamped up to 0.01, which would charge a full
// 36 seconds of the rate for work that was shorter than that.
//
// The rate is never re-resolved here. `time_entries.hourly_rate_snapshot_cents` was frozen by
// resolveHourlyRate at log time, and a rate edited since must not re-price work already done. A
// resolved rate of 0 is a rate a freelancer agreed to (see that service's own note), so a zero-rate
// group bills as a 0-cent line that still shows the work rather than being refused or dropped.
export function planBillableConversion({
  timeEntries,
  expenses,
  grouping,
  hourUnit
}: BillableConversionInput): BillableConversionPlan {
  const scope = resolveSelectionScope([...timeEntries, ...expenses])

  if (scope.outcome !== "resolved") return scope

  const billableGroups: TimeEntryGroup[] = []
  const unbillableTimeEntryIds: string[] = []

  for (const group of groupTimeEntries(timeEntries, grouping)) {
    if (toBilledHours(group.totalSeconds) > 0) {
      billableGroups.push(group)

      continue
    }

    unbillableTimeEntryIds.push(...group.entryIds)
  }

  const timeLines = billableGroups.map((group) => toTimeLineDraft(group, hourUnit))
  const expenseLines = expenses.map(toExpenseLineDraft)
  const lines = [...timeLines, ...expenseLines]

  if (lines.length === 0) return { outcome: "nothingBillable" }

  return {
    outcome: "billable",
    currency: scope.currency,
    clientId: scope.clientId,
    projectId: scope.projectId,
    lines,
    timeEntryIds: billableGroups.flatMap((group) => group.entryIds),
    expenseIds: expenses.map((expense) => expense.id),
    unbillableTimeEntryIds
  }
}

type SelectionScope =
  | Exclude<BillableConversionPlan, { outcome: "billable" }>
  | { outcome: "resolved"; currency: string; clientId: string; projectId: string | null }

// Whether the selection can become one invoice at all, and whose it is. One invoice hangs off one
// client, and `fk_invoices_project_client` refuses a project that is not that client's (ADR-0026),
// so a selection spanning two clients has no representable parent and is refused rather than split
// into two invoices the freelancer did not ask for. A selection spanning two projects of one client
// is fine and produces the client-level invoice the same ADR allows: the project is named only when
// every row agrees on it.
function resolveSelectionScope(
  rows: Array<{
    clientId: string
    projectId: string | null
    currency: string
  }>
): SelectionScope {
  const currencies = [...new Set(rows.map((row) => row.currency))]

  if (currencies.length > 1) return { outcome: "currencyMismatch", currencies: currencies.sort() }

  const clientIds = [...new Set(rows.map((row) => row.clientId))]

  if (clientIds.length > 1) return { outcome: "clientMismatch" }

  const currency = currencies[0]
  const clientId = clientIds[0]

  if (currency === undefined || clientId === undefined) return { outcome: "nothingBillable" }

  const projectIds = [...new Set(rows.map((row) => row.projectId))]

  return {
    outcome: "resolved",
    currency,
    clientId,
    projectId: projectIds.length === 1 ? (projectIds[0] ?? null) : null
  }
}

type TimeEntryGroup = {
  description: string
  hourlyRateSnapshotCents: number
  totalSeconds: number
  entryIds: string[]
}

// The rate is part of every grouping key, whichever dimension was chosen: a line carries one
// `unit_price_cents`, so two entries billed at different rates cannot share one however they are
// grouped, and blending them into an average would produce a unit price nobody agreed to.
function groupTimeEntries(
  rows: BillableTimeEntryRow[],
  grouping: BillableGrouping
): TimeEntryGroup[] {
  const groups = new Map<string, TimeEntryGroup>()

  for (const row of rows) {
    const key = `${toGroupKey(row, grouping)}|${row.hourlyRateSnapshotCents}`
    const existing = groups.get(key)

    if (existing) {
      existing.totalSeconds += row.durationSeconds
      existing.entryIds.push(row.id)

      continue
    }

    groups.set(key, {
      description: toGroupDescription(row, grouping),
      hourlyRateSnapshotCents: row.hourlyRateSnapshotCents,
      totalSeconds: row.durationSeconds,
      entryIds: [row.id]
    })
  }

  return [...groups.values()]
}

function toGroupKey(row: BillableTimeEntryRow, grouping: BillableGrouping): string {
  switch (grouping) {
    case "entry":
      return row.id
    case "task":
      return `${row.projectId}:${row.taskId ?? ""}`
    case "project":
      return row.projectId
  }
}

// The client reads this. Each fallback steps up to the next thing that is certainly present and
// certainly meaningful to them, ending at the project name, which every entry has.
function toGroupDescription(row: BillableTimeEntryRow, grouping: BillableGrouping): string {
  if (grouping === "project") return row.projectName

  if (grouping === "task") return row.taskTitle ?? row.projectName

  return row.description.trim() || row.taskTitle || row.projectName
}

// Provenance is written only for a line drawn from exactly one source row. Naming one member of a
// grouped line would assert of that line a fact true of only part of it, and
// `time_entries.invoiced_in_id` already carries the complete "billed on that invoice" answer for
// every entry in the group (ARCHITECTURE.md's key invariants).
function toTimeLineDraft(group: TimeEntryGroup, hourUnit: string): BillableLineDraft {
  return {
    description: group.description,
    unit: hourUnit,
    quantity: toBilledHours(group.totalSeconds),
    unitPriceCents: group.hourlyRateSnapshotCents,
    sourceTimeEntryId: group.entryIds.length === 1 ? (group.entryIds[0] ?? null) : null,
    sourceExpenseId: null
  }
}

// One line per expense, never grouped: an expense carries its own description, category, receipt and
// markup, and merging two of them would destroy exactly what the client needs in order to check the
// charge. That is also why `source_expense_id` is always populated where a grouped time line's is
// not.
function toExpenseLineDraft(expense: BillableExpenseRow): BillableLineDraft {
  return {
    description: expense.descriptionSuffix
      ? `${expense.description} ${expense.descriptionSuffix}`
      : expense.description,
    unit: null,
    quantity: 1,
    unitPriceCents: expense.rebillableCents,
    sourceTimeEntryId: null,
    sourceExpenseId: expense.id
  }
}
