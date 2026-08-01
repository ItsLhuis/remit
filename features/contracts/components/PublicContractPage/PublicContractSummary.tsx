"use client"

import { useTranslation } from "@/lib/i18n"

import { formatDate, formatDay } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

import { type PublicContract } from "../../types"

import { PublicContractSummaryRow } from "./PublicContractSummaryRow"

type PublicContractSummaryProps = {
  contract: PublicContract
}

const PublicContractSummary = ({ contract }: PublicContractSummaryProps) => {
  const { t } = useTranslation()

  const none = t("contracts.public.summary.none")

  const effectiveFrom = contract.effectiveFrom
    ? formatDay(contract.effectiveFrom, contract.locale)
    : none
  const effectiveUntil = contract.effectiveUntil
    ? formatDay(contract.effectiveUntil, contract.locale)
    : none

  return (
    <Card size="sm" className="h-fit">
      <CardHeader>
        <CardTitle>{t("contracts.public.summary.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <PublicContractSummaryRow
          label={t("contracts.fields.number")}
          value={contract.number}
          mono
        />
        <PublicContractSummaryRow
          label={t("contracts.public.summary.issuedAt")}
          value={formatDate(contract.issuedAt, {
            locale: contract.locale,
            timeZone: contract.timeZone
          })}
        />
        <PublicContractSummaryRow
          label={t("contracts.public.summary.effectiveFrom")}
          value={effectiveFrom}
        />
        <PublicContractSummaryRow
          label={t("contracts.public.summary.effectiveUntil")}
          value={effectiveUntil}
        />
      </CardContent>
    </Card>
  )
}

export { PublicContractSummary }
