"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { type TaskStatus } from "../schemas"

type TaskStatusBadgeProps = {
  status: TaskStatus
}

type StatusPresentation = {
  variant: "secondary" | "info" | "warning" | "success" | "error"
  icon: "Inbox" | "Circle" | "LoaderCircle" | "CircleCheck" | "CircleX"
}

const taskStatusPresentation: Record<TaskStatus, StatusPresentation> = {
  backlog: { variant: "secondary", icon: "Inbox" },
  todo: { variant: "info", icon: "Circle" },
  in_progress: { variant: "warning", icon: "LoaderCircle" },
  done: { variant: "success", icon: "CircleCheck" },
  cancelled: { variant: "error", icon: "CircleX" }
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

export { TaskStatusBadge, taskStatusPresentation }
