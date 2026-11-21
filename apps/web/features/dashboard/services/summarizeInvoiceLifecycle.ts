export const LIFECYCLE_STAGE_IDS = ["draft", "sent", "viewed", "overdue", "paid"] as const

export type LifecycleStageId = (typeof LIFECYCLE_STAGE_IDS)[number]

export type LifecycleInvoiceRow = {
  status: "draft" | "sent" | "paid"
  currency: string
  totalCents: number
  receivableCents: number
  viewCount: number
  isOverdue: boolean
}

export type LifecycleStage = {
  id: LifecycleStageId
  count: number
  cents: number
}

export type InvoiceLifecycle = {
  stages: LifecycleStage[]
  issuedCount: number
  unviewedCount: number
}

// Five named cuts of one population, not a conversion funnel. `viewed` and `overdue` are both
// subsets of `sent` and overlap each other freely, so the counts deliberately do not sum to the
// total and the surface reads them as a magnitude comparison rather than a drop-off. A funnel
// framing was rejected here because it would imply an invoice must be viewed before it can go
// overdue, which is exactly the situation this card exists to expose.
//
// `unviewedCount` is the one derived reading worth stating outright: an issued invoice with
// `view_count = 0` has never been opened by anyone, so chasing it and chasing a viewed one are
// different jobs. `invoices.view_count` is written by `recordPublicInvoiceView` on the `/i/[token]`
// route, so it counts client opens and nothing the freelancer does in the app.
export function summarizeInvoiceLifecycle(
  rows: readonly LifecycleInvoiceRow[],
  currency: string
): InvoiceLifecycle {
  const counts = new Map<LifecycleStageId, number>()
  const cents = new Map<LifecycleStageId, number>()

  let issuedCount = 0
  let unviewedCount = 0

  for (const row of rows) {
    if (row.currency !== currency) continue

    if (row.status === "draft") {
      add(counts, cents, "draft", row.totalCents)

      continue
    }

    issuedCount += 1

    if (row.viewCount === 0) unviewedCount += 1

    if (row.status === "paid") {
      add(counts, cents, "paid", row.totalCents)

      continue
    }

    add(counts, cents, "sent", row.receivableCents)

    if (row.viewCount > 0) add(counts, cents, "viewed", row.receivableCents)
    if (row.isOverdue) add(counts, cents, "overdue", row.receivableCents)
  }

  return {
    stages: LIFECYCLE_STAGE_IDS.map((id) => ({
      id,
      count: counts.get(id) ?? 0,
      cents: cents.get(id) ?? 0
    })),
    issuedCount,
    unviewedCount
  }
}

function add(
  counts: Map<LifecycleStageId, number>,
  cents: Map<LifecycleStageId, number>,
  id: LifecycleStageId,
  amountCents: number
): void {
  counts.set(id, (counts.get(id) ?? 0) + 1)
  cents.set(id, (cents.get(id) ?? 0) + amountCents)
}
