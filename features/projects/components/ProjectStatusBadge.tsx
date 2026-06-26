"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { type ProjectStatus } from "../schemas"

import { projectStatusPresentation } from "./projectStatusPresentation"

type ProjectStatusBadgeProps = {
  status: ProjectStatus
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

export { ProjectStatusBadge }
