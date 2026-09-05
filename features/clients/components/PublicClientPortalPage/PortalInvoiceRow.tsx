"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import { Button, Icon, Typography } from "@/components/ui"

import { InvoiceStatusBadge } from "@/features/invoices"

import { type ClientPortalInvoice } from "../../types"

type PortalInvoiceRowProps = {
  invoice: ClientPortalInvoice
  locale: string
}

const PortalInvoiceRow = ({ invoice, locale }: PortalInvoiceRowProps) => {
  const { t } = useTranslation()

  const { currency } = invoice

  return (
    <li className="border-border flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium">{invoice.number}</span>
          <InvoiceStatusBadge status={invoice.viewStatus} />
        </div>
        <Typography affects={["small", "muted"]}>
          {invoice.dueDate
            ? t("clients.public.invoices.due", { date: formatDay(invoice.dueDate, locale) })
            : t("clients.public.invoices.noDueDate")}
        </Typography>
        {invoice.creditNotes.map((creditNote) => (
          <Typography key={creditNote.number} affects={["small", "muted"]}>
            {t("clients.public.invoices.credited", {
              number: creditNote.number,
              amount: formatCurrency(-creditNote.totalCents, currency, locale)
            })}
          </Typography>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-sm font-medium tabular-nums">
            {formatCurrency(invoice.totalCents, currency, locale)}
          </span>
          {invoice.outstandingCents > 0 && invoice.amountPaidCents > 0 ? (
            <Typography affects={["tiny", "muted"]} className="font-mono tabular-nums">
              {t("clients.public.invoices.stillDue", {
                amount: formatCurrency(invoice.outstandingCents, currency, locale)
              })}
            </Typography>
          ) : null}
        </div>
        {invoice.documentPath ? (
          <Button asChild variant="ghost" size="icon-sm">
            <Link
              href={invoice.documentPath}
              aria-label={t("clients.public.invoices.open", { number: invoice.number })}
            >
              <Icon name="ArrowUpRight" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  )
}

export { PortalInvoiceRow }
