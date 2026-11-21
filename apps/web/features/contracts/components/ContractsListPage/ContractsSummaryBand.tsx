"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCompactNumber } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { type ContractsSummary } from "../../services"

type ContractsSummaryBandProps = {
  summary: ContractsSummary
  locale: string
}

const ContractsSummaryBand = ({ summary, locale }: ContractsSummaryBandProps) => {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon="FileSignature" label={t("contracts.summary.total")}>
        <StatValue
          value={formatCompactNumber(summary.total, locale)}
          title={String(summary.total)}
          hint={t("contracts.summary.totalHint")}
        />
      </StatCard>
      <StatCard icon="PencilLine" label={t("contracts.summary.draft")}>
        <StatValue
          value={formatCompactNumber(summary.draft, locale)}
          title={String(summary.draft)}
          hint={t("contracts.summary.draftHint")}
        />
      </StatCard>
      <StatCard icon="Send" label={t("contracts.summary.sent")}>
        <StatValue
          value={formatCompactNumber(summary.sent, locale)}
          title={String(summary.sent)}
          hint={t("contracts.summary.sentHint")}
        />
      </StatCard>
      <StatCard icon="CircleCheck" label={t("contracts.summary.signed")}>
        <StatValue
          value={formatCompactNumber(summary.signed, locale)}
          title={String(summary.signed)}
          hint={t("contracts.summary.signedHint")}
        />
      </StatCard>
    </div>
  )
}

export { ContractsSummaryBand }
