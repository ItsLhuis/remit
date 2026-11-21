"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { proposalStatusPresentation } from "../labels"
import { type ProposalStatus } from "../schemas"

type ProposalStatusBadgeProps = {
  status: ProposalStatus
}

const ProposalStatusBadge = ({ status }: ProposalStatusBadgeProps) => {
  const { t } = useTranslation()

  const presentation = proposalStatusPresentation[status]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(`proposals.status.${status}`)}
    </Badge>
  )
}

export { ProposalStatusBadge }
