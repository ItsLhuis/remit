const MILLISECONDS_PER_DAY = 86_400_000

export const AGING_BUCKET_IDS = ["notDue", "days1To30", "days31To60", "days61Plus"] as const

export type AgingBucketId = (typeof AGING_BUCKET_IDS)[number]

export type AgingInvoiceRow = {
  currency: string
  receivableCents: number
  dueDate: Date | null
}

export type AgingBucket = {
  id: AgingBucketId
  cents: number
  count: number
  sharePercentage: number
}

export type ReceivablesAging = {
  buckets: AgingBucket[]
  totalCents: number
  lateCents: number
  oldestDaysLate: number
}

// The four standard receivable ages, always all four and always in order, so the bar the surface
// draws keeps its segments in the same places whether or not a bucket has money in it. An invoice
// with no due date sits in `notDue`: nothing has been promised, so nothing can be late.
//
// Ages are measured in whole UTC days between due date and today, the same comparison
// `isInvoiceOverdue` in features/invoices/services/invoiceStatusView.ts makes, so a row this file
// calls one day late cannot be a row the invoice list still calls current.
export function summarizeReceivablesAging(
  rows: readonly AgingInvoiceRow[],
  currency: string,
  now: Date
): ReceivablesAging {
  const today = toUtcDayValue(now)
  const cents = new Map<AgingBucketId, number>()
  const counts = new Map<AgingBucketId, number>()

  let totalCents = 0
  let lateCents = 0
  let oldestDaysLate = 0

  for (const row of rows) {
    if (row.currency !== currency || row.receivableCents === 0) continue

    const daysLate = row.dueDate
      ? Math.round((today - toUtcDayValue(row.dueDate)) / MILLISECONDS_PER_DAY)
      : 0
    const bucket = toBucketId(daysLate)

    cents.set(bucket, (cents.get(bucket) ?? 0) + row.receivableCents)
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)

    totalCents += row.receivableCents

    if (bucket === "notDue") continue

    lateCents += row.receivableCents
    oldestDaysLate = Math.max(oldestDaysLate, daysLate)
  }

  return {
    buckets: AGING_BUCKET_IDS.map((id) => {
      const bucketCents = cents.get(id) ?? 0

      return {
        id,
        cents: bucketCents,
        count: counts.get(id) ?? 0,
        sharePercentage: totalCents === 0 ? 0 : Math.round((bucketCents / totalCents) * 1000) / 10
      }
    }),
    totalCents,
    lateCents,
    oldestDaysLate
  }
}

function toBucketId(daysLate: number): AgingBucketId {
  if (daysLate <= 0) return "notDue"
  if (daysLate <= 30) return "days1To30"
  if (daysLate <= 60) return "days31To60"

  return "days61Plus"
}

function toUtcDayValue(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}
