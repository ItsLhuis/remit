export type CurrencyTotal = {
  currency: string
  totalCents: number
}

export type PrimaryCurrency = {
  currency: string
  otherCurrencyCount: number
}

// Every money figure on the dashboard is a per-currency bucket rather than one combined number.
// Remit holds no exchange rates, so adding cents across currencies would be arithmetic on unlike
// units — the same reason `features/invoices/services/summarizeInvoices.ts` buckets outstanding
// value. Sorted by value so the surface can lead with the currency that carries the most money.
export function toCurrencyTotals(totals: ReadonlyMap<string, number>): CurrencyTotal[] {
  return Array.from(totals.entries())
    .map(([currency, totalCents]) => ({ currency, totalCents }))
    .sort((first, second) => second.totalCents - first.totalCents)
}

export function getCurrencyTotal(totals: readonly CurrencyTotal[], currency: string): number {
  return totals.find((total) => total.currency === currency)?.totalCents ?? 0
}

// The single currency the whole dashboard speaks, resolved once from every bucket together so a
// revenue tile and a receivable tile can never lead with different units. Buckets are weighed
// combined rather than in priority order, so one large unpaid invoice cannot outvote a year of
// banked payments in another currency. `otherCurrencyCount` is what lets each tile say that the
// figure it shows is not the whole picture.
export function resolvePrimaryCurrency(
  buckets: readonly (readonly CurrencyTotal[])[],
  fallback: string
): PrimaryCurrency {
  const combined = new Map<string, number>()

  for (const bucket of buckets) {
    for (const total of bucket) {
      combined.set(total.currency, (combined.get(total.currency) ?? 0) + total.totalCents)
    }
  }

  const ranked = toCurrencyTotals(combined)
  const leading = ranked[0]

  if (!leading) return { currency: fallback, otherCurrencyCount: 0 }

  return { currency: leading.currency, otherCurrencyCount: ranked.length - 1 }
}
