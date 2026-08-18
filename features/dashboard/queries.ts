import { and, eq, gte, isNull, sql, type SQL } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { database } from "@/database"
import {
  clients,
  creditNotes,
  expenses,
  invoices,
  payments,
  projects,
  timeEntries
} from "@/database/schema"

import { listActivity } from "@/features/activityLog/server"

import { isInvoiceOverdue } from "@/features/invoices/server"

import { parseDashboardQuery } from "./schemas"
import {
  buildCashflowSeries,
  buildInvoiceAttention,
  buildSignalAttention,
  getCurrencyTotal,
  getReceivableCents,
  isWithinWindow,
  rankAttentionItems,
  resolveComparisonRange,
  resolveDashboardWindow,
  resolveEarliestWindowStart,
  resolvePrimaryCurrency,
  selectUpcomingInvoices,
  selectUpcomingSchedules,
  startOfUtcYear,
  sumRangeCents,
  summarizeDelta,
  summarizeExpenseSpend,
  summarizeInvoiceLifecycle,
  summarizeLeadPipeline,
  summarizeReceivables,
  summarizeReceivablesAging,
  summarizeRevenue,
  summarizeTopClients,
  summarizeUnbilledWork,
  toCashflowNetSeries,
  type AttentionInvoiceRow,
  type CashflowRow,
  type ClientRevenueRow,
  type DashboardWindow,
  type RangedAmountRow
} from "./services"
import {
  listActiveSchedules,
  listDueTasks,
  listLeadStatusCounts,
  listOpenContracts,
  listOpenProposals
} from "./signalQueries"
import { type DashboardDefaults, type DashboardPageData } from "./types"

const CASHFLOW_MONTHS = 12
const RECENT_ACTIVITY_LIMIT = 6

// The client of a project-level invoice, reached through its project. Aliased because the same
// `clients` table is also joined directly for an invoice raised straight against a client, and an
// invoice may carry either link, or both — the same shape `features/invoices/overviewQueries.ts`
// uses for the invoice list.
const projectClients = alias(clients, "project_clients")

// One read per table, aggregated in memory rather than one query per tile. Every tile, the
// twelve-month chart, the aging bar and the lifecycle card are cuts of the same populations, and
// asking the database separately for each would issue a dozen queries whose answers could disagree
// if a payment landed between them. `now` is resolved once and threaded through every service for
// the same reason.
//
// Every read is issued together rather than in two waves. They are independent and indexed, so the
// wall time is the slowest single query either way, and splitting them would buy a second round
// trip's worth of nothing while letting two halves of the page disagree about `now`. The route
// streams the whole body behind one Suspense boundary instead, so the page shell and its period
// control paint without waiting for any of this.
export async function getDashboardPageData(input: unknown): Promise<DashboardPageData> {
  const query = parseDashboardQuery(input)
  const now = new Date()

  const periodWindow = resolveDashboardWindow(query.period, now)
  const comparisonRange = resolveComparisonRange(query.period, now)
  const cashflowWindow: DashboardWindow = {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (CASHFLOW_MONTHS - 1), 1))
  }
  const readFrom = resolveEarliestWindowStart([
    periodWindow,
    cashflowWindow,
    { start: comparisonRange?.start ?? null },
    { start: startOfUtcYear(now) }
  ])

  const [
    defaults,
    paymentRows,
    invoiceRows,
    expenseRows,
    unbilledTime,
    unbilledExpenses,
    leadCounts,
    proposalRows,
    contractRows,
    taskRows,
    scheduleRows,
    activity
  ] = await Promise.all([
    getDashboardDefaults(),
    listRevenuePayments(readFrom),
    listInvoices(now),
    listExpenseSpend(readFrom),
    listUnbilledTime(),
    listUnbilledExpenses(),
    listLeadStatusCounts(),
    listOpenProposals(),
    listOpenContracts(),
    listDueTasks(now),
    listActiveSchedules(),
    listActivity({ entityType: null, read: "all", page: 1, perPage: RECENT_ACTIVITY_LIMIT })
  ])

  const receivableRows = invoiceRows.filter((row) => row.status === "sent")

  const revenue = summarizeRevenue(paymentRows, now, periodWindow)
  const receivables = summarizeReceivables(receivableRows)
  const expenseSpend = summarizeExpenseSpend(expenseRows, periodWindow)

  const { currency, otherCurrencyCount } = resolvePrimaryCurrency(
    [revenue.yearToDate, receivables.outstanding, expenseSpend.period],
    defaults.defaultCurrency
  )

  const periodRevenueCents = getCurrencyTotal(revenue.period, currency)
  const periodExpenseCents = getCurrencyTotal(expenseSpend.period, currency)

  const previousRevenueCents = sumRangeCents(
    toRangedRows(paymentRows, (row) => row.paidAt),
    comparisonRange,
    currency
  )
  const previousExpenseCents = sumRangeCents(
    toRangedRows(expenseRows, (row) => row.spentAt),
    comparisonRange,
    currency
  )

  // Invoice-derived items are built from the rows already read for the money tiers rather than from
  // a second read, so the rail and the receivable figures can never disagree about which invoice is
  // late.
  const attention = rankAttentionItems([
    ...buildInvoiceAttention(receivableRows, now),
    ...buildSignalAttention(
      { proposals: proposalRows, contracts: contractRows, tasks: taskRows },
      now
    )
  ])

  const cashflow = buildCashflowSeries(
    {
      revenue: toCashflowRows(paymentRows, currency, cashflowWindow, (row) => row.paidAt),
      expenses: toCashflowRows(expenseRows, currency, cashflowWindow, (row) => row.spentAt)
    },
    now,
    CASHFLOW_MONTHS
  )

  return {
    query,
    currency,
    otherCurrencyCount,
    receivables: {
      outstandingCents: getCurrencyTotal(receivables.outstanding, currency),
      outstandingCount: receivables.outstandingCount,
      overdueCents: getCurrencyTotal(receivables.overdue, currency),
      overdueCount: receivables.overdueCount
    },
    aging: summarizeReceivablesAging(receivableRows, currency, now),
    metrics: {
      revenue: {
        delta: summarizeDelta(periodRevenueCents, previousRevenueCents),
        series: cashflow.map((point) => point.revenueCents)
      },
      expenses: {
        delta: summarizeDelta(periodExpenseCents, previousExpenseCents),
        series: cashflow.map((point) => point.expenseCents)
      },
      // An estimate, and labelled as one where it is read: it subtracts recorded expenses from
      // banked payments in one currency, so it knows nothing about tax, unrecorded costs, or work
      // earning in another currency.
      net: {
        delta: summarizeDelta(
          periodRevenueCents - periodExpenseCents,
          previousRevenueCents === null || previousExpenseCents === null
            ? null
            : previousRevenueCents - previousExpenseCents
        ),
        series: toCashflowNetSeries(cashflow)
      }
    },
    unbilled: summarizeUnbilledWork(unbilledTime, unbilledExpenses, currency),
    cashflow,
    lifecycle: summarizeInvoiceLifecycle(invoiceRows, currency),
    upcomingInvoices: selectUpcomingInvoices(receivableRows, now),
    topClients: summarizeTopClients(toClientRevenueRows(paymentRows, periodWindow), currency),
    attention: attention.items,
    attentionTotalCount: attention.totalCount,
    pipeline: summarizeLeadPipeline(leadCounts),
    schedules: selectUpcomingSchedules(scheduleRows, now),
    activity: activity.rows,
    defaults
  }
}

async function getDashboardDefaults(): Promise<DashboardDefaults> {
  const row = await database.query.settings.findFirst({
    columns: {
      defaultCurrency: true,
      defaultLocale: true,
      defaultTimezone: true
    }
  })

  return {
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en",
    defaultTimezone: row?.defaultTimezone ?? "UTC"
  }
}

type RevenuePaymentReadRow = {
  amountCents: number
  currency: string
  paidAt: Date
  clientId: string | null
  clientName: string | null
}

// The payment's own currency, not the invoice's: a payment records what actually arrived, and it is
// the settlement record every revenue figure on this page is built from. Payments against a
// soft-deleted invoice are excluded — that money is no longer attributable to a live document.
async function listRevenuePayments(from: Date | null): Promise<RevenuePaymentReadRow[]> {
  const conditions: SQL[] = [isNull(payments.deletedAt), isNull(invoices.deletedAt)]

  if (from) conditions.push(gte(payments.paidAt, from))

  const rows = await database
    .select({
      amountCents: payments.amountCents,
      currency: payments.currency,
      paidAt: payments.paidAt,
      clientId: sql<string | null>`coalesce(${invoices.clientId}, ${projects.clientId})`,
      clientName: sql<string | null>`coalesce(${clients.name}, ${projectClients.name})`
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
    .where(and(...conditions))

  return rows.map((row) => ({
    amountCents: Number(row.amountCents),
    currency: row.currency,
    paidAt: row.paidAt,
    clientId: row.clientId,
    clientName: row.clientName
  }))
}

type InvoiceReadRow = AttentionInvoiceRow & {
  status: "draft" | "sent" | "paid"
  totalCents: number
  amountPaidCents: number
  creditedCents: number
}

// Every live invoice, not only the issued ones: the lifecycle card counts drafts and settled
// invoices as well, and reading the table twice for two cuts of the same rows would let the two
// cards disagree. Invoices whose project or client has since been soft-deleted are kept — money
// owed does not stop being owed because the project closed — which is the same population
// `features/invoices/overviewQueries.ts` lists for the same reason.
async function listInvoices(now: Date): Promise<InvoiceReadRow[]> {
  const creditNoteTotals = getCreditNoteTotalsSubquery()

  const rows = await database
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      projectId: invoices.projectId,
      currency: invoices.currency,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      viewCount: invoices.viewCount,
      creditedCents: sql<number>`cast(coalesce(${creditNoteTotals.creditedCents}, 0) as bigint)`,
      parentName: sql<
        string | null
      >`coalesce(${clients.name}, ${projectClients.name}, ${projects.name})`
    })
    .from(invoices)
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
    .leftJoin(creditNoteTotals, eq(creditNoteTotals.invoiceId, invoices.id))
    .where(isNull(invoices.deletedAt))

  return rows.map((row) => {
    const totalCents = Number(row.totalCents)
    const amountPaidCents = Number(row.amountPaidCents)
    const creditedCents = Number(row.creditedCents)

    return {
      id: row.id,
      number: row.number,
      status: row.status,
      projectId: row.projectId,
      parentName: row.parentName ?? "",
      currency: row.currency,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      totalCents,
      amountPaidCents,
      creditedCents,
      viewCount: row.viewCount,
      receivableCents: getReceivableCents({ totalCents, amountPaidCents, creditedCents }),
      // Derived through the invoices feature's own predicate rather than restated here, so the
      // dashboard's overdue count can never contradict the badge the invoice list renders.
      isOverdue: isInvoiceOverdue(
        { status: row.status, dueDate: row.dueDate, paidAt: row.paidAt },
        now
      )
    }
  })
}

type ExpenseSpendReadRow = {
  amountCents: number
  currency: string
  spentAt: Date
}

async function listExpenseSpend(from: Date | null): Promise<ExpenseSpendReadRow[]> {
  const conditions: SQL[] = [isNull(expenses.deletedAt)]

  if (from) conditions.push(gte(expenses.spentAt, from))

  const rows = await database
    .select({
      amountCents: expenses.amountCents,
      currency: expenses.currency,
      spentAt: expenses.spentAt
    })
    .from(expenses)
    .where(and(...conditions))

  return rows.map((row) => ({
    amountCents: Number(row.amountCents),
    currency: row.currency,
    spentAt: row.spentAt
  }))
}

type UnbilledTimeReadRow = {
  currency: string
  durationSeconds: number
  hourlyRateSnapshotCents: number
}

// A time entry carries no currency of its own, so it inherits the same ladder its rate does —
// project, then client — resolved in SQL here rather than in the service, which never sees a
// settings row. An entry whose project and client are both silent is left out of the total instead
// of being assigned the instance default, because guessing the currency of money owed is exactly
// the kind of quiet error this page exists not to make.
async function listUnbilledTime(): Promise<UnbilledTimeReadRow[]> {
  const rows = await database
    .select({
      durationSeconds: timeEntries.durationSeconds,
      hourlyRateSnapshotCents: timeEntries.hourlyRateSnapshotCents,
      currency: sql<string | null>`coalesce(${projects.currency}, ${clients.currency})`
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(
      and(
        isNull(timeEntries.deletedAt),
        isNull(timeEntries.invoicedInId),
        eq(timeEntries.billable, true)
      )
    )

  return rows.flatMap((row) =>
    row.currency && row.durationSeconds
      ? [
          {
            currency: row.currency,
            durationSeconds: row.durationSeconds,
            hourlyRateSnapshotCents: Number(row.hourlyRateSnapshotCents)
          }
        ]
      : []
  )
}

type UnbilledExpenseReadRow = {
  currency: string
  amountCents: number
  markupPercentage: number | null
}

async function listUnbilledExpenses(): Promise<UnbilledExpenseReadRow[]> {
  const rows = await database
    .select({
      amountCents: expenses.amountCents,
      currency: expenses.currency,
      markupPercentage: expenses.markupPercentage
    })
    .from(expenses)
    .where(
      and(isNull(expenses.deletedAt), isNull(expenses.invoicedInId), eq(expenses.rebillable, true))
    )

  return rows.map((row) => ({
    amountCents: Number(row.amountCents),
    currency: row.currency,
    markupPercentage: row.markupPercentage === null ? null : Number(row.markupPercentage)
  }))
}

function getCreditNoteTotalsSubquery() {
  return database
    .select({
      invoiceId: creditNotes.invoiceId,
      creditedCents: sql<number>`cast(coalesce(sum(${creditNotes.totalCents}), 0) as bigint)`.as(
        "credited_cents"
      )
    })
    .from(creditNotes)
    .where(isNull(creditNotes.deletedAt))
    .groupBy(creditNotes.invoiceId)
    .as("invoice_credit_note_totals")
}

function toRangedRows<TRow extends { amountCents: number; currency: string }>(
  rows: readonly TRow[],
  getOccurredAt: (row: TRow) => Date
): RangedAmountRow[] {
  return rows.map((row) => ({
    occurredAt: getOccurredAt(row),
    amountCents: row.amountCents,
    currency: row.currency
  }))
}

function toCashflowRows<TRow extends { amountCents: number; currency: string }>(
  rows: readonly TRow[],
  currency: string,
  window: DashboardWindow,
  getOccurredAt: (row: TRow) => Date
): CashflowRow[] {
  return rows.flatMap((row) => {
    const occurredAt = getOccurredAt(row)

    if (row.currency !== currency || !isWithinWindow(occurredAt, window)) return []

    return [{ occurredAt, amountCents: row.amountCents }]
  })
}

function toClientRevenueRows(
  rows: readonly RevenuePaymentReadRow[],
  window: DashboardWindow
): ClientRevenueRow[] {
  return rows.flatMap((row) =>
    row.clientId && row.clientName && isWithinWindow(row.paidAt, window)
      ? [
          {
            clientId: row.clientId,
            clientName: row.clientName,
            currency: row.currency,
            amountCents: row.amountCents
          }
        ]
      : []
  )
}
