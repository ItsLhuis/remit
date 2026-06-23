"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { useTranslation } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

import { Card, Icon, IconButton, Typography } from "@/components/ui"

import { type TaskStatus } from "../../schemas"
import { type TaskItem } from "../../types"
import { TaskPriorityBadge } from "../TaskPriorityBadge"

import { TaskStatusMenu } from "./TaskStatusMenu"

type TaskCardProps = {
  task: TaskItem
  locale: string
  index: number
  count: number
  onChangeStatus: (taskId: string, status: TaskStatus) => void
  onMove: (taskId: string, toIndex: number) => void
  onEdit: (task: TaskItem) => void
  onDelete: (task: TaskItem) => void
}

const TaskCard = ({
  task,
  locale,
  index,
  count,
  onChangeStatus,
  onMove,
  onEdit,
  onDelete
}: TaskCardProps) => {
  const { t } = useTranslation()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const dueText = task.dueAt
    ? `${t("tasks.card.dueLabel")} ${formatDay(task.dueAt, locale)}`
    : t("tasks.card.noDue")

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : undefined}>
      <Card size="sm" className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <IconButton
            variant="ghost"
            size="icon-sm"
            label={t("tasks.card.dragHandle")}
            className="cursor-grab"
            {...attributes}
            {...listeners}
          >
            <Icon name="GripVertical" />
          </IconButton>
          <Typography affects={["small", "medium"]} className="min-w-0 flex-1 break-words">
            {task.title}
          </Typography>
          <TaskStatusMenu
            status={task.status}
            canMoveUp={index > 0}
            canMoveDown={index < count - 1}
            onChangeStatus={(status) => onChangeStatus(task.id, status)}
            onMoveUp={() => onMove(task.id, index - 1)}
            onMoveDown={() => onMove(task.id, index + 1)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task)}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <TaskPriorityBadge priority={task.priority} />
          <Typography affects={["muted", "tiny"]}>{dueText}</Typography>
        </div>
      </Card>
    </div>
  )
}

export { TaskCard }
