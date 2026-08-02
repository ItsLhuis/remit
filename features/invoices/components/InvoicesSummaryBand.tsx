"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCompactCurrency, formatCompactNumber, formatCurrency } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { type InvoicesSummaryResult } from "../services"

type InvoicesSummaryBandProps = {
  summary: InvoicesSummaryResult
  currency: string
  locale: string
  totalHint: string
}

const InvoicesSummaryBand = ({
  summary,
  currency,
  locale,
  totalHint
}: InvoicesSummaryBandProps) => {
  const { t } = useTranslation()

  const topOutstanding = summary.outstandingByCurrency[0]
  const outstandingCents = topOutstanding?.totalCents ?? 0
  const outstandingCurrency = topOutstanding?.currency ?? currency

  const outstandingHint = summary.hasSingleCurrency
    ? t("invoices.summary.outstandingHint")
    : t("invoices.summary.outstandingMultiCurrency", {
        count: summary.outstandingByCurrency.length
      })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon="Receipt" label={t("invoices.summary.total")}>
        <StatValue
          value={formatCompactNumber(summary.total, locale)}
          title={String(summary.total)}
          hint={totalHint}
        />
      </StatCard>
      <StatCard icon="PencilLine" label={t("invoices.summary.draft")}>
        <StatValue
          value={formatCompactNumber(summary.draft, locale)}
          title={String(summary.draft)}
          hint={t("invoices.summary.draftHint")}
        />
      </StatCard>
      <StatCard icon="TriangleAlert" label={t("invoices.summary.overdue")}>
        <StatValue
          value={formatCompactNumber(summary.overdue, locale)}
          title={String(summary.overdue)}
          hint={t("invoices.summary.overdueHint")}
        />
      </StatCard>
      <StatCard icon="Banknote" label={t("invoices.summary.outstanding")}>
        <StatValue
          value={formatCompactCurrency(outstandingCents, outstandingCurrency, locale)}
          title={formatCurrency(outstandingCents, outstandingCurrency, locale)}
          hint={outstandingHint}
          mono
        />
      </StatCard>
    </div>
  )
}

export { InvoicesSummaryBand }
