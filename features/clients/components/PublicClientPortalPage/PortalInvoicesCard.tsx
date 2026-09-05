"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Typography
} from "@/components/ui"

import { type OutstandingByCurrency } from "../../services"
import { type ClientPortalInvoice } from "../../types"

import { PortalInvoiceRow } from "./PortalInvoiceRow"
import { PortalSectionEmpty } from "./PortalSectionEmpty"

type PortalInvoicesCardProps = {
  invoices: ClientPortalInvoice[]
  outstanding: OutstandingByCurrency[]
  locale: string
}

const PortalInvoicesCard = ({ invoices, outstanding, locale }: PortalInvoicesCardProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("clients.public.invoices.title")}</CardTitle>
        <CardDescription>{t("clients.public.invoices.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <PortalSectionEmpty
            icon="ReceiptText"
            title={t("clients.public.invoices.emptyTitle")}
            description={t("clients.public.invoices.emptyDescription")}
          />
        ) : (
          <ul className="flex flex-col">
            {invoices.map((invoice) => (
              <PortalInvoiceRow key={invoice.number} invoice={invoice} locale={locale} />
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-1">
        {outstanding.length === 0 ? (
          <Typography affects={["small", "medium"]}>
            {t("clients.public.invoices.nothingOutstanding")}
          </Typography>
        ) : (
          outstanding.map((total) => (
            <div key={total.currency} className="flex items-baseline justify-between gap-4">
              <Typography affects={["small", "medium"]}>
                {t("clients.public.invoices.outstanding")}
              </Typography>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {formatCurrency(total.totalCents, total.currency, locale)}
              </span>
            </div>
          ))
        )}
      </CardFooter>
    </Card>
  )
}

export { PortalInvoicesCard }
