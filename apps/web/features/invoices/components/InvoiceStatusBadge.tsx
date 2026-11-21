"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { invoiceStatusPresentation } from "../labels"
import { type InvoiceViewStatus } from "../schemas"

type InvoiceStatusBadgeProps = {
  status: InvoiceViewStatus
}

const InvoiceStatusBadge = ({ status }: InvoiceStatusBadgeProps) => {
  const { t } = useTranslation()

  const presentation = invoiceStatusPresentation[status]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(`invoices.status.${status}`)}
    </Badge>
  )
}

export { InvoiceStatusBadge }
