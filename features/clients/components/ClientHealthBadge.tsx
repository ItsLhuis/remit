"use client"

import { useTranslation } from "@/lib/i18n"

import { type ClientHealth } from "../services"

import { Badge, Icon } from "@/components/ui"

type ClientHealthBadgeProps = {
  health: ClientHealth
}

type HealthPresentation = {
  variant: "warning" | "success" | "secondary"
  icon: "Clock" | "CircleCheck" | "CircleDashed"
  labelKey: "clients.health.owing" | "clients.health.settled" | "clients.health.dormant"
}

const HEALTH_PRESENTATION: Record<ClientHealth, HealthPresentation> = {
  owing: { variant: "warning", icon: "Clock", labelKey: "clients.health.owing" },
  settled: { variant: "success", icon: "CircleCheck", labelKey: "clients.health.settled" },
  dormant: { variant: "secondary", icon: "CircleDashed", labelKey: "clients.health.dormant" }
}

const ClientHealthBadge = ({ health }: ClientHealthBadgeProps) => {
  const { t } = useTranslation()

  const presentation = HEALTH_PRESENTATION[health]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(presentation.labelKey)}
    </Badge>
  )
}

export { ClientHealthBadge }
