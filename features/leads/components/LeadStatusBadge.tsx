"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { type LeadStatus } from "../schemas"

type LeadStatusBadgeProps = {
  status: LeadStatus
}

type StatusPresentation = {
  variant: "secondary" | "info" | "warning" | "default" | "success" | "error"
  icon: "Sparkles" | "Phone" | "CircleDot" | "Send" | "Trophy" | "CircleX"
}

const leadStatusPresentation: Record<LeadStatus, StatusPresentation> = {
  new: { variant: "secondary", icon: "Sparkles" },
  contacted: { variant: "info", icon: "Phone" },
  qualified: { variant: "warning", icon: "CircleDot" },
  proposal_sent: { variant: "default", icon: "Send" },
  won: { variant: "success", icon: "Trophy" },
  lost: { variant: "error", icon: "CircleX" }
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

export { LeadStatusBadge, leadStatusPresentation }
