"use client"

import { Fragment } from "react"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icon,
  Separator,
  Typography
} from "@/components/ui"

import { type PublicInvoice } from "../../types"

import { PublicInvoicePaymentMethods } from "./PublicInvoicePaymentMethods"

type PublicInvoicePaymentCardProps = {
  invoice: PublicInvoice
}

const PublicInvoicePaymentCard = ({ invoice }: PublicInvoicePaymentCardProps) => {
  const { t } = useTranslation()

  const isSettled = invoice.outstandingCents === 0

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          {isSettled
            ? t("invoices.public.payment.settledTitle")
            : t("invoices.public.payment.title")}
        </CardTitle>
        <CardDescription>
          {isSettled
            ? t("invoices.public.payment.settledDescription")
            : t("invoices.public.payment.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Typography affects={["small", "medium"]}>
            {isSettled
              ? t("invoices.public.payment.amountSettled")
              : t("invoices.public.payment.amountDue")}
          </Typography>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {formatCurrency(
              isSettled ? invoice.totalCents : invoice.outstandingCents,
              invoice.currency,
              invoice.locale
            )}
          </span>
        </div>
        {isSettled ? (
          <div className="flex items-center gap-2">
            <Icon name="CircleCheck" aria-hidden="true" className="text-success-border" />
            <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
              {t("invoices.public.payment.settledNote")}
            </Typography>
          </div>
        ) : (
          <Fragment>
            <Separator />
            <PublicInvoicePaymentMethods payment={invoice.payment} reference={invoice.number} />
          </Fragment>
        )}
      </CardContent>
    </Card>
  )
}

export { PublicInvoicePaymentCard }
