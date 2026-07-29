"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDate, formatDay } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle, Separator, Typography } from "@/components/ui"

import { type PublicProposal } from "../../types"
import { ProposalDetailRow } from "../ProposalDetailRow"

type PublicProposalSummaryProps = {
  proposal: PublicProposal
}

const PublicProposalSummary = ({ proposal }: PublicProposalSummaryProps) => {
  const { t } = useTranslation()

  const { currency, locale, timeZone } = proposal

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("proposals.public.summary.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <ProposalDetailRow
          label={t("proposals.public.summary.issuedAt")}
          value={formatDate(proposal.issuedAt, { locale, timeZone })}
        />
        <ProposalDetailRow
          label={t("proposals.public.summary.validUntil")}
          value={
            proposal.validUntil
              ? formatDay(proposal.validUntil, locale)
              : t("proposals.public.summary.noValidUntil")
          }
        />
        <Separator />
        <ProposalDetailRow
          label={t("proposals.totals.subtotal")}
          value={formatCurrency(proposal.subtotalCents, currency, locale)}
          mono
        />
        <ProposalDetailRow
          label={t("proposals.totals.discount")}
          value={formatCurrency(-proposal.discountAmountTotalCents, currency, locale)}
          mono
        />
        <ProposalDetailRow
          label={t("proposals.totals.tax")}
          value={formatCurrency(proposal.taxAmountCents, currency, locale)}
          mono
        />
        <Separator />
        <div className="flex items-baseline justify-between gap-4">
          <Typography affects={["small", "medium"]}>{t("proposals.totals.total")}</Typography>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatCurrency(proposal.totalCents, currency, locale)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export { PublicProposalSummary }
