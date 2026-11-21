"use client"

import { useTranslation } from "@/lib/i18n"

import { Typography } from "@/components/ui"

import { type PublicInvoice } from "../../types"
import { InvoiceLineItemsTable } from "../InvoiceLineItemsTable"
import { InvoiceStatusBadge } from "../InvoiceStatusBadge"

import { PublicInvoicePaymentCard } from "./PublicInvoicePaymentCard"
import { PublicInvoiceSummary } from "./PublicInvoiceSummary"

type PublicInvoicePageProps = {
  invoice: PublicInvoice
}

const PublicInvoicePage = ({ invoice }: PublicInvoicePageProps) => {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-8 md:p-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Typography affects={["muted", "small"]}>{t("invoices.public.fromLabel")}</Typography>
          <Typography affects="medium">{invoice.issuer.name}</Typography>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Typography variant="h2" className="font-mono">
            {invoice.number}
          </Typography>
          <InvoiceStatusBadge status={invoice.viewStatus} />
        </div>
        {invoice.preparedFor ? (
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            {t("invoices.public.preparedFor", { parent: invoice.preparedFor })}
          </Typography>
        ) : null}
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* `min-w-0` is load-bearing: a grid item defaults to `min-width: auto`, so without it the
        line-items table widens this column to its content and pushes the whole page sideways on a
        phone instead of scrolling inside its own container. */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <InvoiceLineItemsTable
            lineItems={invoice.lineItems}
            currency={invoice.currency}
            locale={invoice.locale}
          />
          {invoice.notes ? (
            <div className="flex flex-col gap-2">
              <Typography affects={["small", "medium"]}>
                {t("invoices.detail.notesTitle")}
              </Typography>
              <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
                {invoice.notes}
              </Typography>
            </div>
          ) : null}
          <PublicInvoicePaymentCard invoice={invoice} />
        </div>
        <PublicInvoiceSummary invoice={invoice} />
      </div>
    </main>
  )
}

export { PublicInvoicePage }
