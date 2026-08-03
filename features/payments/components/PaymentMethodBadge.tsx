"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { paymentMethodPresentation } from "../labels"
import { type PaymentMethod } from "../schemas"

type PaymentMethodBadgeProps = {
  method: PaymentMethod
}

const PaymentMethodBadge = ({ method }: PaymentMethodBadgeProps) => {
  const { t } = useTranslation()

  const presentation = paymentMethodPresentation[method]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(`payments.method.${method}`)}
    </Badge>
  )
}

export { PaymentMethodBadge }
