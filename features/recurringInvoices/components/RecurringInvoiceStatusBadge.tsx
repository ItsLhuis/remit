"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { recurringInvoiceStatusPresentation } from "../labels"
import { type RecurringInvoiceStatus } from "../schemas"

type RecurringInvoiceStatusBadgeProps = {
  status: RecurringInvoiceStatus
}

const RecurringInvoiceStatusBadge = ({ status }: RecurringInvoiceStatusBadgeProps) => {
  const { t } = useTranslation()

  const presentation = recurringInvoiceStatusPresentation[status]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(`recurringInvoices.status.${status}`)}
    </Badge>
  )
}

export { RecurringInvoiceStatusBadge }
