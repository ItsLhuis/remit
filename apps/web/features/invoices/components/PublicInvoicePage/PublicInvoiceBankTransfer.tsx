"use client"

import { useTranslation } from "@/lib/i18n"

import { Icon, Typography } from "@/components/ui"

import { type PublicInvoicePayment } from "../../types"
import { InvoiceDetailRow } from "../InvoiceDetailRow"

type PublicInvoiceBankTransferProps = {
  payment: PublicInvoicePayment
  reference: string
}

const PublicInvoiceBankTransfer = ({ payment, reference }: PublicInvoiceBankTransferProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon name="Landmark" aria-hidden="true" className="text-muted-foreground" />
        <Typography affects={["small", "medium"]}>
          {t("invoices.public.payment.bankTitle")}
        </Typography>
      </div>
      {payment.bankName ? (
        <InvoiceDetailRow label={t("invoices.public.payment.bankName")} value={payment.bankName} />
      ) : null}
      {payment.ibanDisplay ? (
        <InvoiceDetailRow
          label={t("invoices.public.payment.iban")}
          value={payment.ibanDisplay}
          mono
        />
      ) : null}
      <InvoiceDetailRow label={t("invoices.public.payment.reference")} value={reference} mono />
      {payment.instructions ? (
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {payment.instructions}
        </Typography>
      ) : null}
    </div>
  )
}

export { PublicInvoiceBankTransfer }
