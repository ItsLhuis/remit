export type CreditNoteSummaryInput = {
  invoiceId: string
  currency: string
  totalCents: number
}

export type CreditedValue = {
  currency: string
  totalCents: number
}

export type CreditNotesSummaryResult = {
  total: number
  invoicesCredited: number
  creditedByCurrency: CreditedValue[]
  averageCents: number
  hasSingleCurrency: boolean
}

// Credited value is bucketed per currency rather than summed: an invoice may be priced in any
// currency and Remit holds no exchange rates, so a single total would be a number that means
// nothing. The same reasoning as summarizeInvoices in features/invoices/services.
//
// `averageCents` is reported in the largest bucket's currency only, which the band labels; averaging
// across currencies would be the same category error.
export function summarizeCreditNotes(
  creditNotes: readonly CreditNoteSummaryInput[]
): CreditNotesSummaryResult {
  const creditedTotals = new Map<string, number>()
  const invoiceIds = new Set<string>()

  for (const creditNote of creditNotes) {
    invoiceIds.add(creditNote.invoiceId)
    creditedTotals.set(
      creditNote.currency,
      (creditedTotals.get(creditNote.currency) ?? 0) + creditNote.totalCents
    )
  }

  const creditedByCurrency = Array.from(creditedTotals.entries())
    .map(([currency, totalCents]) => ({ currency, totalCents }))
    .sort((first, second) => second.totalCents - first.totalCents)

  const top = creditedByCurrency[0]
  const topCount = top
    ? creditNotes.filter((creditNote) => creditNote.currency === top.currency).length
    : 0

  return {
    total: creditNotes.length,
    invoicesCredited: invoiceIds.size,
    creditedByCurrency,
    averageCents: topCount === 0 ? 0 : Math.round((top?.totalCents ?? 0) / topCount),
    hasSingleCurrency: creditedByCurrency.length <= 1
  }
}
