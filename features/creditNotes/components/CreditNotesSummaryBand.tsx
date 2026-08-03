"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCompactCurrency, formatCompactNumber, formatCurrency } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { type CreditNotesSummaryResult } from "../services"

type CreditNotesSummaryBandProps = {
  summary: CreditNotesSummaryResult
  currency: string
  locale: string
}

const CreditNotesSummaryBand = ({ summary, currency, locale }: CreditNotesSummaryBandProps) => {
  const { t } = useTranslation()

  const topCredited = summary.creditedByCurrency[0]
  const creditedCents = topCredited?.totalCents ?? 0
  const creditedCurrency = topCredited?.currency ?? currency

  const creditedHint = summary.hasSingleCurrency
    ? t("creditNotes.summary.creditedHint")
    : t("creditNotes.summary.creditedMultiCurrency", {
        count: summary.creditedByCurrency.length
      })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon="ReceiptText" label={t("creditNotes.summary.total")}>
        <StatValue
          value={formatCompactNumber(summary.total, locale)}
          title={String(summary.total)}
          hint={t("creditNotes.summary.totalHint")}
        />
      </StatCard>
      <StatCard icon="Banknote" label={t("creditNotes.summary.credited")}>
        <StatValue
          value={formatCompactCurrency(creditedCents, creditedCurrency, locale)}
          title={formatCurrency(creditedCents, creditedCurrency, locale)}
          hint={creditedHint}
          mono
        />
      </StatCard>
      <StatCard icon="Receipt" label={t("creditNotes.summary.invoicesCredited")}>
        <StatValue
          value={formatCompactNumber(summary.invoicesCredited, locale)}
          title={String(summary.invoicesCredited)}
          hint={t("creditNotes.summary.invoicesCreditedHint")}
        />
      </StatCard>
      <StatCard icon="Scale" label={t("creditNotes.summary.average")}>
        <StatValue
          value={formatCompactCurrency(summary.averageCents, creditedCurrency, locale)}
          title={formatCurrency(summary.averageCents, creditedCurrency, locale)}
          hint={t("creditNotes.summary.averageHint")}
          mono
        />
      </StatCard>
    </div>
  )
}

export { CreditNotesSummaryBand }
