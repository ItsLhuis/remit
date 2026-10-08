import { type OutstandingByCurrency } from "./summarizeClients"

export type PortalOutstandingRow = {
  currency: string
  outstandingCents: number
}

// A client can hold invoices in more than one currency and the portal has no exchange rate to
// collapse them with — `invoices.exchange_rate` is the rate the freelancer books revenue at, not a
// rate a recipient should be shown — so what is still owed is reported once per currency instead of
// as one figure. Settled invoices are dropped rather than summed to zero: a line reading 0 answers a
// question nobody asked and competes with the currency that does carry a balance.
export function summarizePortalOutstanding(
  rows: readonly PortalOutstandingRow[]
): OutstandingByCurrency[] {
  const totals = new Map<string, number>()

  for (const row of rows) {
    if (row.outstandingCents <= 0) continue

    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.outstandingCents)
  }

  return [...totals].map(([currency, totalCents]) => ({ currency, totalCents }))
}
