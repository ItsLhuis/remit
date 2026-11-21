const MILLISECONDS_PER_DAY = 86_400_000

// How long a document may sit unopened before it becomes something to chase. An invoice mailed this
// morning is not a problem; one issued a week ago that nobody has opened is the case
// `invoices.view_count` exists to expose.
const UNVIEWED_INVOICE_DAYS = 3
const STALE_PROPOSAL_DAYS = 5
const UNSIGNED_CONTRACT_DAYS = 3
const EXPIRING_PROPOSAL_DAYS = 7
const TASK_HORIZON_DAYS = 3

export const ATTENTION_LIMIT = 7

export type AttentionKind =
  | "invoiceOverdue"
  | "invoiceUnviewed"
  | "proposalExpiring"
  | "proposalStale"
  | "contractUnsigned"
  | "taskDue"

export type AttentionSeverity = "error" | "warning" | "info"

export type AttentionItem = {
  // Kind-prefixed because one entity can raise two different items — an invoice can be both overdue
  // and never opened — and React needs the two rows to be distinguishable.
  id: string
  kind: AttentionKind
  severity: AttentionSeverity
  subject: string
  context: string
  // Whole days, signed by the kind's own reading: elapsed for the overdue and stale kinds, remaining
  // for the two that look forward. The surface picks the sentence; this file only counts.
  days: number
  amountCents: number | null
  currency: string | null
  href: string
}

export type AttentionInvoiceRow = {
  id: string
  number: string
  parentName: string
  projectId: string | null
  currency: string
  receivableCents: number
  issueDate: Date | null
  viewCount: number
  isOverdue: boolean
  dueDate: Date | null
}

export type AttentionProposalRow = {
  id: string
  number: string
  parentName: string
  currency: string
  totalCents: number
  validUntil: Date | null
  issuedAt: Date | null
  viewCount: number
}

export type AttentionContractRow = {
  id: string
  number: string
  title: string
  issuedAt: Date | null
}

export type AttentionTaskRow = {
  id: string
  title: string
  projectId: string
  projectName: string
  dueAt: Date
}

const SEVERITY_ORDER: Record<AttentionSeverity, number> = { error: 0, warning: 1, info: 2 }

// Everything the freelancer is being asked to do, gathered from five documents into one ranked
// list. Split from `rankAttentionItems` because the invoice population is already read for the
// money tiers and the other four are read separately; keeping the two builders apart lets the page
// compose them without reading invoices twice.
export function buildInvoiceAttention(
  rows: readonly AttentionInvoiceRow[],
  now: Date
): AttentionItem[] {
  const today = toUtcDayValue(now)
  const items: AttentionItem[] = []

  for (const row of rows) {
    if (row.receivableCents === 0) continue

    const href = row.projectId ? `/projects/${row.projectId}/invoices/${row.id}` : "/invoices"

    if (row.isOverdue && row.dueDate) {
      items.push({
        id: `invoiceOverdue:${row.id}`,
        kind: "invoiceOverdue",
        severity: "error",
        subject: row.number,
        context: row.parentName,
        days: daysBetween(today, row.dueDate),
        amountCents: row.receivableCents,
        currency: row.currency,
        href
      })
    }

    if (row.viewCount > 0 || !row.issueDate) continue

    const daysSinceIssued = daysBetween(today, row.issueDate)

    if (daysSinceIssued < UNVIEWED_INVOICE_DAYS) continue

    items.push({
      id: `invoiceUnviewed:${row.id}`,
      kind: "invoiceUnviewed",
      severity: "warning",
      subject: row.number,
      context: row.parentName,
      days: daysSinceIssued,
      amountCents: row.receivableCents,
      currency: row.currency,
      href
    })
  }

  return items
}

export type SignalAttentionInput = {
  proposals: readonly AttentionProposalRow[]
  contracts: readonly AttentionContractRow[]
  tasks: readonly AttentionTaskRow[]
}

export function buildSignalAttention(input: SignalAttentionInput, now: Date): AttentionItem[] {
  const today = toUtcDayValue(now)

  return [
    ...buildProposalAttention(input.proposals, today),
    ...buildContractAttention(input.contracts, today),
    ...buildTaskAttention(input.tasks, today)
  ]
}

// A proposal raises at most one item. Expiry outranks silence: a proposal that is about to lapse
// needs the same action whether or not it was ever opened, and two rows for one document would push
// something else off the rail.
function buildProposalAttention(
  rows: readonly AttentionProposalRow[],
  today: number
): AttentionItem[] {
  return rows.flatMap((row): AttentionItem[] => {
    // The top-level route, not the project-scoped one: a proposal may hang off a client with no
    // project at all (`chk_proposals_parent`), and `/proposals/[proposalId]` resolves either shape.
    const href = `/proposals/${row.id}`
    const daysRemaining = row.validUntil ? -daysBetween(today, row.validUntil) : null

    if (daysRemaining !== null && daysRemaining <= EXPIRING_PROPOSAL_DAYS) {
      return [
        {
          id: `proposalExpiring:${row.id}`,
          kind: "proposalExpiring",
          severity: daysRemaining < 0 ? "warning" : "info",
          subject: row.number,
          context: row.parentName,
          days: daysRemaining,
          amountCents: row.totalCents,
          currency: row.currency,
          href
        }
      ]
    }

    if (row.viewCount > 0 || !row.issuedAt) return []

    const daysSinceIssued = daysBetween(today, row.issuedAt)

    if (daysSinceIssued < STALE_PROPOSAL_DAYS) return []

    return [
      {
        id: `proposalStale:${row.id}`,
        kind: "proposalStale",
        severity: "info",
        subject: row.number,
        context: row.parentName,
        days: daysSinceIssued,
        amountCents: row.totalCents,
        currency: row.currency,
        href
      }
    ]
  })
}

function buildContractAttention(
  rows: readonly AttentionContractRow[],
  today: number
): AttentionItem[] {
  return rows.flatMap((row): AttentionItem[] => {
    if (!row.issuedAt) return []

    const daysSinceIssued = daysBetween(today, row.issuedAt)

    if (daysSinceIssued < UNSIGNED_CONTRACT_DAYS) return []

    return [
      {
        id: `contractUnsigned:${row.id}`,
        kind: "contractUnsigned",
        severity: "info",
        subject: row.number,
        context: row.title,
        days: daysSinceIssued,
        amountCents: null,
        currency: null,
        href: `/contracts/${row.id}`
      }
    ]
  })
}

function buildTaskAttention(rows: readonly AttentionTaskRow[], today: number): AttentionItem[] {
  return rows.flatMap((row): AttentionItem[] => {
    const daysRemaining = -daysBetween(today, row.dueAt)

    if (daysRemaining > TASK_HORIZON_DAYS) return []

    return [
      {
        id: `taskDue:${row.id}`,
        kind: "taskDue",
        severity: daysRemaining < 0 ? "warning" : "info",
        subject: row.title,
        context: row.projectName,
        days: daysRemaining,
        amountCents: null,
        currency: null,
        href: `/projects/${row.projectId}/tasks`
      }
    ]
  })
}

export type RankedAttention = {
  items: AttentionItem[]
  totalCount: number
}

// Severity first, then the oldest or most imminent within a severity, then the subject so two rows
// that tie cannot swap places between renders. `totalCount` is the untruncated size, because a rail
// that silently drops the eighth thing needing attention is worse than one that says there are more.
export function rankAttentionItems(
  items: readonly AttentionItem[],
  limit = ATTENTION_LIMIT
): RankedAttention {
  const ranked = items.toSorted((first, second) => {
    const bySeverity = SEVERITY_ORDER[first.severity] - SEVERITY_ORDER[second.severity]

    if (bySeverity !== 0) return bySeverity

    const byDays = toUrgency(second) - toUrgency(first)

    if (byDays !== 0) return byDays

    return first.subject.localeCompare(second.subject)
  })

  return { items: ranked.slice(0, limit), totalCount: ranked.length }
}

// Elapsed kinds already count upwards with age; the forward-looking kinds count down towards zero,
// so their urgency is the negation. Both then rank high-to-low on one scale.
function toUrgency(item: AttentionItem): number {
  return item.kind === "proposalExpiring" || item.kind === "taskDue" ? -item.days : item.days
}

function daysBetween(todayValue: number, value: Date): number {
  return Math.round((todayValue - toUtcDayValue(value)) / MILLISECONDS_PER_DAY)
}

function toUtcDayValue(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}
