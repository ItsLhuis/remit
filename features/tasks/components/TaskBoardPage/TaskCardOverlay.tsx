"use client"

import { useTranslation } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

import { Card, Typography } from "@/components/ui"

import { type TaskItem } from "../../types"
import { TaskPriorityBadge } from "../TaskPriorityBadge"

type TaskCardOverlayProps = {
  task: TaskItem
  locale: string
}

const TaskCardOverlay = ({ task, locale }: TaskCardOverlayProps) => {
  const { t } = useTranslation()

  const dueText = task.dueAt
    ? `${t("tasks.card.dueLabel")} ${formatDay(task.dueAt, locale)}`
    : t("tasks.card.noDue")

  return (
    <Card
      size="sm"
      className="ring-foreground/20 w-72 rotate-2 cursor-grabbing gap-0 shadow-lg select-none motion-reduce:rotate-0"
    >
      <Typography affects={["small", "medium"]} className="line-clamp-2 leading-snug">
        {task.title}
      </Typography>
      <div className="mt-2 flex items-center gap-1.5">
        <TaskPriorityBadge priority={task.priority} />
        <Typography affects={["muted", "tiny"]} className="truncate">
          {dueText}
        </Typography>
      </div>
    </Card>
  )
}

export { TaskCardOverlay }
