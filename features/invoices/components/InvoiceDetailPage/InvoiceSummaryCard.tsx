"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDate, formatDay } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle, Separator, Typography } from "@/components/ui"

import { getInvoiceOutstandingCents } from "../../services"
import { type InvoiceDetail } from "../../types"
import { InvoiceDetailRow } from "../InvoiceDetailRow"

type InvoiceSummaryCardProps = {
  invoice: InvoiceDetail
}

const InvoiceSummaryCard = ({ invoice }: InvoiceSummaryCardProps) => {
  const { t } = useTranslation()

  const locale = invoice.defaults.defaultLocale
  const timeZone = invoice.defaults.defaultTimezone

  const outstandingCents = getInvoiceOutstandingCents(invoice)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("invoices.detail.summaryTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <InvoiceDetailRow
          label={t("invoices.fields.issueDate")}
          value={
            invoice.issueDate
              ? formatDay(invoice.issueDate, locale)
              : t("invoices.detail.notIssued")
          }
        />
        <InvoiceDetailRow
          label={t("invoices.fields.dueDate")}
          value={
            invoice.dueDate ? formatDay(invoice.dueDate, locale) : t("invoices.table.noDueDate")
          }
        />
        <InvoiceDetailRow
          label={t("invoices.detail.paidAt")}
          value={
            invoice.paidAt
              ? formatDate(invoice.paidAt, { locale, timeZone })
              : t("invoices.detail.notPaid")
          }
        />
        <InvoiceDetailRow
          label={t("invoices.fields.template")}
          value={invoice.templateName ?? t("invoices.template.none")}
        />
        <InvoiceDetailRow
          label={t("invoices.detail.viewsLabel")}
          value={t("invoices.detail.viewCount", { count: invoice.viewCount })}
        />
        <Separator />
        <InvoiceDetailRow
          label={t("invoices.totals.subtotal")}
          value={formatCurrency(invoice.subtotalCents, invoice.currency, locale)}
          mono
        />
        <InvoiceDetailRow
          label={t("invoices.totals.discount")}
          value={formatCurrency(-invoice.discountAmountTotalCents, invoice.currency, locale)}
          mono
        />
        <InvoiceDetailRow
          label={t("invoices.totals.tax")}
          value={formatCurrency(invoice.taxAmountCents, invoice.currency, locale)}
          mono
        />
        <Separator />
        <div className="flex items-baseline justify-between gap-4">
          <Typography affects={["small", "medium"]}>{t("invoices.totals.total")}</Typography>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatCurrency(invoice.totalCents, invoice.currency, locale)}
          </span>
        </div>
        <InvoiceDetailRow
          label={t("invoices.totals.amountPaid")}
          value={formatCurrency(invoice.amountPaidCents, invoice.currency, locale)}
          mono
        />
        <InvoiceDetailRow
          label={t("invoices.totals.outstanding")}
          value={formatCurrency(outstandingCents, invoice.currency, locale)}
          mono
        />
      </CardContent>
    </Card>
  )
}

export { InvoiceSummaryCard }
