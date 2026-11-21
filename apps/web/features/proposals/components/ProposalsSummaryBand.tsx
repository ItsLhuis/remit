"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCompactCurrency, formatCompactNumber, formatCurrency } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { type ProposalsSummaryResult } from "../services"

type ProposalsSummaryBandProps = {
  summary: ProposalsSummaryResult
  currency: string
  locale: string
  totalHint: string
}

const ProposalsSummaryBand = ({
  summary,
  currency,
  locale,
  totalHint
}: ProposalsSummaryBandProps) => {
  const { t } = useTranslation()

  const topAccepted = summary.acceptedValueByCurrency[0]
  const acceptedValueCents = topAccepted?.totalCents ?? 0
  const acceptedCurrency = topAccepted?.currency ?? currency

  const acceptedHint = summary.hasSingleCurrency
    ? t("proposals.summary.accepted")
    : t("proposals.summary.acceptedMultiCurrency", {
        count: summary.acceptedValueByCurrency.length
      })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon="FileText" label={t("proposals.summary.total")}>
        <StatValue
          value={formatCompactNumber(summary.total, locale)}
          title={String(summary.total)}
          hint={totalHint}
        />
      </StatCard>
      <StatCard icon="PencilLine" label={t("proposals.summary.draft")}>
        <StatValue
          value={formatCompactNumber(summary.draft, locale)}
          title={String(summary.draft)}
          hint={t("proposals.summary.draftHint")}
        />
      </StatCard>
      <StatCard icon="Send" label={t("proposals.summary.awaiting")}>
        <StatValue
          value={formatCompactNumber(summary.awaiting, locale)}
          title={String(summary.awaiting)}
          hint={t("proposals.summary.awaitingHint")}
        />
      </StatCard>
      <StatCard icon="CircleCheck" label={t("proposals.summary.acceptedValue")}>
        <StatValue
          value={formatCompactCurrency(acceptedValueCents, acceptedCurrency, locale)}
          title={formatCurrency(acceptedValueCents, acceptedCurrency, locale)}
          hint={acceptedHint}
          mono
        />
      </StatCard>
    </div>
  )
}

export { ProposalsSummaryBand }
