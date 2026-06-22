"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { type ProjectStatus } from "../schemas"

type ProjectStatusBadgeProps = {
  status: ProjectStatus
}

type StatusPresentation = {
  variant: "secondary" | "info" | "warning" | "default" | "success" | "error"
  icon: "Play" | "Pause" | "CircleCheck" | "CircleX"
}

const projectStatusPresentation: Record<ProjectStatus, StatusPresentation> = {
  active: { variant: "success", icon: "Play" },
  on_hold: { variant: "warning", icon: "Pause" },
  completed: { variant: "info", icon: "CircleCheck" },
  cancelled: { variant: "error", icon: "CircleX" }
}

const ProjectStatusBadge = ({ status }: ProjectStatusBadgeProps) => {
  const { t } = useTranslation()

  const presentation = projectStatusPresentation[status]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(`projects.status.${status}`)}
    </Badge>
  )
}

export { ProjectStatusBadge, projectStatusPresentation }
