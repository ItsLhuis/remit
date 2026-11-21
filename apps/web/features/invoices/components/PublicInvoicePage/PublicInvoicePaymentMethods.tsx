"use client"

import { Fragment } from "react"

import { useTranslation } from "@/lib/i18n"

import { Separator, Typography } from "@/components/ui"

import { type PublicInvoicePayment } from "../../types"

import { PublicInvoiceBankTransfer } from "./PublicInvoiceBankTransfer"
import { PublicInvoiceCardPayment } from "./PublicInvoiceCardPayment"

type PublicInvoicePaymentMethodsProps = {
  payment: PublicInvoicePayment
  reference: string
}

const PublicInvoicePaymentMethods = ({ payment, reference }: PublicInvoicePaymentMethodsProps) => {
  const { t } = useTranslation()

  if (!payment.hasBankTransferDetails && !payment.stripeConfigured) {
    return (
      <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
        {t("invoices.public.payment.noMethods")}
      </Typography>
    )
  }

  return (
    <Fragment>
      {payment.hasBankTransferDetails ? (
        <PublicInvoiceBankTransfer payment={payment} reference={reference} />
      ) : null}
      {payment.hasBankTransferDetails && payment.stripeConfigured ? <Separator /> : null}
      {payment.stripeConfigured ? <PublicInvoiceCardPayment /> : null}
    </Fragment>
  )
}

export { PublicInvoicePaymentMethods }
