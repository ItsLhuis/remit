"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { type TaskStatus } from "../schemas"

import { taskStatusPresentation } from "./taskStatusPresentation"

type TaskStatusBadgeProps = {
  status: TaskStatus
}

const TaskStatusBadge = ({ status }: TaskStatusBadgeProps) => {
  const { t } = useTranslation()

  const presentation = taskStatusPresentation[status]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(`tasks.status.${status}`)}
    </Badge>
  )
}

export { TaskStatusBadge }
