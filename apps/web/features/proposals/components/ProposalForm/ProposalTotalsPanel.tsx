"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { Card, CardContent, Separator } from "@/components/ui"

import { type ProposalTotals } from "../../services"

import { ProposalTotalsRow } from "./ProposalTotalsRow"

type ProposalTotalsPanelProps = {
  totals: ProposalTotals
  currency: string
  locale: string
}

const ProposalTotalsPanel = ({ totals, currency, locale }: ProposalTotalsPanelProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm" className="sm:ml-auto sm:w-80">
      <CardContent className="flex flex-col gap-2">
        <ProposalTotalsRow
          label={t("proposals.totals.subtotal")}
          value={formatCurrency(totals.subtotalCents, currency, locale)}
        />
        <ProposalTotalsRow
          label={t("proposals.totals.discount")}
          value={formatCurrency(-totals.discountAmountTotalCents, currency, locale)}
        />
        <ProposalTotalsRow
          label={t("proposals.totals.tax")}
          value={formatCurrency(totals.taxAmountCents, currency, locale)}
        />
        <Separator />
        <ProposalTotalsRow
          label={t("proposals.totals.total")}
          value={formatCurrency(totals.totalCents, currency, locale)}
          emphasis
        />
      </CardContent>
    </Card>
  )
}

export { ProposalTotalsPanel }
