"use client"

import { useTranslation } from "@/lib/i18n"

import { Alert, AlertDescription, AlertTitle, Icon } from "@/components/ui"

import { type InvoiceLateFee } from "../../types"

type InvoiceLateFeeOffDocumentAlertProps = {
  lateFee: InvoiceLateFee
}

const InvoiceLateFeeOffDocumentAlert = ({ lateFee }: InvoiceLateFeeOffDocumentAlertProps) => {
  const { t } = useTranslation()

  if (lateFee.feeCents === 0 || lateFee.shownOnDocument) return null

  return (
    <Alert>
      <Icon name="TriangleAlert" aria-hidden="true" />
      <AlertTitle>{t("invoices.detail.lateFeeNotOnDocumentTitle")}</AlertTitle>
      <AlertDescription>{t("invoices.detail.lateFeeNotOnDocumentDescription")}</AlertDescription>
    </Alert>
  )
}

export { InvoiceLateFeeOffDocumentAlert }
