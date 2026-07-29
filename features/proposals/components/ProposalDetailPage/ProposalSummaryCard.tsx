"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDate, formatDay } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle, Separator, Typography } from "@/components/ui"

import { type ProposalDetail } from "../../types"
import { ProposalDetailRow } from "../ProposalDetailRow"

type ProposalSummaryCardProps = {
  proposal: ProposalDetail
}

const ProposalSummaryCard = ({ proposal }: ProposalSummaryCardProps) => {
  const { t } = useTranslation()

  const locale = proposal.defaults.defaultLocale
  const timeZone = proposal.defaults.defaultTimezone

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("proposals.detail.summaryTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <ProposalDetailRow
          label={t("proposals.detail.issuedAt")}
          value={
            proposal.issuedAt
              ? formatDate(proposal.issuedAt, { locale, timeZone })
              : t("proposals.detail.notIssued")
          }
        />
        <ProposalDetailRow
          label={t("proposals.fields.validUntil")}
          value={
            proposal.validUntil
              ? formatDay(proposal.validUntil, locale)
              : t("proposals.table.noValidUntil")
          }
        />
        <ProposalDetailRow
          label={t("proposals.fields.template")}
          value={proposal.templateName ?? t("proposals.template.none")}
        />
        <ProposalDetailRow
          label={t("proposals.detail.viewsLabel")}
          value={t("proposals.detail.viewCount", { count: proposal.viewCount })}
        />
        <Separator />
        <ProposalDetailRow
          label={t("proposals.totals.subtotal")}
          value={formatCurrency(proposal.subtotalCents, proposal.currency, locale)}
          mono
        />
        <ProposalDetailRow
          label={t("proposals.totals.discount")}
          value={formatCurrency(-proposal.discountAmountTotalCents, proposal.currency, locale)}
          mono
        />
        <ProposalDetailRow
          label={t("proposals.totals.tax")}
          value={formatCurrency(proposal.taxAmountCents, proposal.currency, locale)}
          mono
        />
        <Separator />
        <div className="flex items-baseline justify-between gap-4">
          <Typography affects={["small", "medium"]}>{t("proposals.totals.total")}</Typography>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatCurrency(proposal.totalCents, proposal.currency, locale)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export { ProposalSummaryCard }
