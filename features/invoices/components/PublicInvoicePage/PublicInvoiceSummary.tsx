"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDate, formatDay } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle, Separator, Typography } from "@/components/ui"

import { type PublicInvoice } from "../../types"
import { InvoiceDetailRow } from "../InvoiceDetailRow"

type PublicInvoiceSummaryProps = {
  invoice: PublicInvoice
}

const PublicInvoiceSummary = ({ invoice }: PublicInvoiceSummaryProps) => {
  const { t } = useTranslation()

  const { currency, locale, timeZone } = invoice

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("invoices.public.summary.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <InvoiceDetailRow
          label={t("invoices.public.summary.issueDate")}
          value={
            invoice.issueDate
              ? formatDay(invoice.issueDate, locale)
              : t("invoices.public.summary.noDate")
          }
        />
        <InvoiceDetailRow
          label={t("invoices.public.summary.dueDate")}
          value={
            invoice.dueDate
              ? formatDay(invoice.dueDate, locale)
              : t("invoices.public.summary.noDate")
          }
        />
        {invoice.paidAt ? (
          <InvoiceDetailRow
            label={t("invoices.public.summary.paidAt")}
            value={formatDate(invoice.paidAt, { locale, timeZone })}
          />
        ) : null}
        <Separator />
        <InvoiceDetailRow
          label={t("invoices.totals.subtotal")}
          value={formatCurrency(invoice.subtotalCents, currency, locale)}
          mono
        />
        <InvoiceDetailRow
          label={t("invoices.totals.discount")}
          value={formatCurrency(-invoice.discountAmountTotalCents, currency, locale)}
          mono
        />
        <InvoiceDetailRow
          label={t("invoices.totals.tax")}
          value={formatCurrency(invoice.taxAmountCents, currency, locale)}
          mono
        />
        <Separator />
        <div className="flex items-baseline justify-between gap-4">
          <Typography affects={["small", "medium"]}>{t("invoices.totals.total")}</Typography>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatCurrency(invoice.totalCents, currency, locale)}
          </span>
        </div>
        {invoice.amountPaidCents > 0 ? (
          <InvoiceDetailRow
            label={t("invoices.totals.amountPaid")}
            value={formatCurrency(invoice.amountPaidCents, currency, locale)}
            mono
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

export { PublicInvoiceSummary }
