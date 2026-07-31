"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatDate, formatDay } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle, Typography } from "@/components/ui"

import { type ContractDetail } from "../../types"

type ContractSummaryRowProps = {
  label: string
  value: string
  mono?: boolean
}

const ContractSummaryRow = ({ label, value, mono }: ContractSummaryRowProps) => (
  <div className="flex items-baseline justify-between gap-4">
    <Typography affects={["muted", "small"]}>{label}</Typography>
    <span className={mono ? "font-mono text-sm tabular-nums" : "text-sm"}>{value}</span>
  </div>
)

type ContractSummaryCardProps = {
  contract: ContractDetail
  locale: string
  timeZone: string
}

const ContractSummaryCard = ({ contract, locale, timeZone }: ContractSummaryCardProps) => {
  const { t } = useTranslation()

  const effectiveFrom = contract.effectiveFrom ? formatDay(contract.effectiveFrom, locale) : "—"
  const effectiveUntil = contract.effectiveUntil ? formatDay(contract.effectiveUntil, locale) : "—"

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("contracts.detail.summaryTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ContractSummaryRow label={t("contracts.fields.number")} value={contract.number} mono />
        <ContractSummaryRow
          label={t("contracts.fields.issuedAt")}
          value={
            contract.issuedAt
              ? formatDate(contract.issuedAt, { locale, timeZone })
              : t("contracts.detail.notIssued")
          }
        />
        <ContractSummaryRow label={t("contracts.fields.effectiveFrom")} value={effectiveFrom} />
        <ContractSummaryRow label={t("contracts.fields.effectiveUntil")} value={effectiveUntil} />
        {contract.projectId ? (
          <div className="flex items-baseline justify-between gap-4">
            <Typography affects={["muted", "small"]}>{t("contracts.fields.project")}</Typography>
            <Link
              href={`/projects/${contract.projectId}`}
              className="truncate text-sm hover:underline"
            >
              {contract.projectName ?? t("contracts.detail.openParent")}
            </Link>
          </div>
        ) : null}
        {contract.clientId ? (
          <div className="flex items-baseline justify-between gap-4">
            <Typography affects={["muted", "small"]}>{t("contracts.fields.client")}</Typography>
            <Link
              href={`/clients/${contract.clientId}`}
              className="truncate text-sm hover:underline"
            >
              {contract.clientName ?? t("contracts.detail.openParent")}
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { ContractSummaryCard }
