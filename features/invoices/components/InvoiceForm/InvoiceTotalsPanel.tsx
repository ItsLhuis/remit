"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { Card, CardContent, Separator } from "@/components/ui"

import { type InvoiceTotals } from "../../services"

import { InvoiceTotalsRow } from "./InvoiceTotalsRow"

type InvoiceTotalsPanelProps = {
  totals: InvoiceTotals
  currency: string
  locale: string
}

const InvoiceTotalsPanel = ({ totals, currency, locale }: InvoiceTotalsPanelProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm" className="sm:ml-auto sm:w-80">
      <CardContent className="flex flex-col gap-2">
        <InvoiceTotalsRow
          label={t("invoices.totals.subtotal")}
          value={formatCurrency(totals.subtotalCents, currency, locale)}
        />
        <InvoiceTotalsRow
          label={t("invoices.totals.discount")}
          value={formatCurrency(-totals.discountAmountTotalCents, currency, locale)}
        />
        <InvoiceTotalsRow
          label={t("invoices.totals.tax")}
          value={formatCurrency(totals.taxAmountCents, currency, locale)}
        />
        <Separator />
        <InvoiceTotalsRow
          label={t("invoices.totals.total")}
          value={formatCurrency(totals.totalCents, currency, locale)}
          emphasis
        />
      </CardContent>
    </Card>
  )
}

export { InvoiceTotalsPanel }
