"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { type TaskPriority } from "../schemas"

type TaskPriorityBadgeProps = {
  priority: TaskPriority
}

type PriorityPresentation = {
  variant: "secondary" | "outline" | "warning" | "error"
  icon: "ChevronDown" | "Minus" | "ChevronUp" | "ChevronsUp"
}

const taskPriorityPresentation: Record<TaskPriority, PriorityPresentation> = {
  low: { variant: "secondary", icon: "ChevronDown" },
  normal: { variant: "outline", icon: "Minus" },
  high: { variant: "warning", icon: "ChevronUp" },
  urgent: { variant: "error", icon: "ChevronsUp" }
}

const TaskPriorityBadge = ({ priority }: TaskPriorityBadgeProps) => {
  const { t } = useTranslation()

  const presentation = taskPriorityPresentation[priority]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(`tasks.priority.${priority}`)}
    </Badge>
  )
}

export { TaskPriorityBadge }
