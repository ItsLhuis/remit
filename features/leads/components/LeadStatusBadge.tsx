"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { type LeadStatus } from "../schemas"

import { leadStatusPresentation } from "./leadStatusPresentation"

type LeadStatusBadgeProps = {
  status: LeadStatus
}

const LeadStatusBadge = ({ status }: LeadStatusBadgeProps) => {
  const { t } = useTranslation()

  const presentation = leadStatusPresentation[status]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(`leads.status.${status}`)}
    </Badge>
  )
}

export { LeadStatusBadge }
