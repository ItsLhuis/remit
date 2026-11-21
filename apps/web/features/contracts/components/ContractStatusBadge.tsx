"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { contractStatusPresentation } from "../labels"
import { type ContractDisplayStatus } from "../types"

type ContractStatusBadgeProps = {
  status: ContractDisplayStatus
}

const ContractStatusBadge = ({ status }: ContractStatusBadgeProps) => {
  const { t } = useTranslation()

  const presentation = contractStatusPresentation[status]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(`contracts.status.${status}`)}
    </Badge>
  )
}

export { ContractStatusBadge }
