"use client"

import { useState } from "react"

import { useSortable } from "@dnd-kit/react/sortable"

import { useTranslation } from "@/lib/i18n"

import { cn, formatDay } from "@/lib/utils"

import {
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Typography
} from "@/components/ui"

import { taskStatusPresentation } from "../../labels"
import { type TaskStatus } from "../../schemas"
import { getNextTaskStatuses } from "../../services"
import { type TaskItem } from "../../types"
import { TaskPriorityBadge } from "../TaskPriorityBadge"

type TaskCardProps = {
  task: TaskItem
  index: number
  locale: string
  isPending?: boolean
  onEdit: (task: TaskItem) => void
  onDelete: (task: TaskItem) => void
  onChangeStatus: (task: TaskItem, status: TaskStatus) => void
}

const TaskCard = ({
  task,
  index,
  locale,
  isPending = false,
  onEdit,
  onDelete,
  onChangeStatus
}: TaskCardProps) => {
  const { t } = useTranslation()

  const { ref, handleRef, isDragSource } = useSortable({
    id: task.id,
    index,
    group: task.status,
    type: "item",
    accept: "item",
    disabled: isPending,
    data: { title: task.title }
  })

  const [menuOpen, setMenuOpen] = useState(false)

  const nextStatuses = getNextTaskStatuses(task.status)

  const dueText = task.dueAt
    ? `${t("tasks.card.dueLabel")} ${formatDay(task.dueAt, locale)}`
    : t("tasks.card.noDue")

  return (
    <div ref={ref}>
      <Card
        size="sm"
        data-pending={isPending}
        onContextMenu={(event) => {
          if (isPending) return

          event.preventDefault()

          setMenuOpen(true)
        }}
        className={cn(
          "group/task hover:ring-foreground/20 hover:bg-muted/50 relative gap-0 transition-colors",
          isDragSource && "opacity-50",
          isPending && "pointer-events-none opacity-60"
        )}
      >
        <div
          className={cn(
            "absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/task:opacity-100 focus-within:opacity-100 max-md:opacity-100",
            menuOpen && "opacity-100"
          )}
        >
          <IconButton
            ref={handleRef}
            size="icon-sm"
            label={t("tasks.card.dragHandle")}
            disabled={isPending}
            className="cursor-grab touch-none active:cursor-grabbing"
          >
            <Icon name="GripVertical" />
          </IconButton>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <IconButton size="icon-sm" label={t("tasks.card.actions")} disabled={isPending}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => onEdit(task)}>
                <Icon name="Pencil" aria-hidden="true" />
                {t("tasks.card.edit")}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Icon name="ArrowRightLeft" aria-hidden="true" />
                  {t("tasks.card.changeStatus")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  {nextStatuses.map((next) => (
                    <DropdownMenuItem
                      key={next}
                      variant={next === "cancelled" ? "destructive" : "default"}
                      onSelect={() => onChangeStatus(task, next)}
                    >
                      <Icon name={taskStatusPresentation[next].icon} aria-hidden="true" />
                      {t(`tasks.status.${next}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(task)}>
                <Icon name="Trash2" aria-hidden="true" />
                {t("tasks.card.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onEdit(task)}
          className="flex w-full cursor-pointer flex-col items-start gap-2 text-left outline-none"
        >
          <Typography affects={["small", "medium"]} className="line-clamp-2 pr-12 leading-snug">
            {task.title}
          </Typography>
          <div className="flex max-w-full items-center gap-1.5">
            <TaskPriorityBadge priority={task.priority} />
            <Typography affects={["muted", "tiny"]} className="truncate">
              {dueText}
            </Typography>
          </div>
        </button>
      </Card>
    </div>
  )
}

export { TaskCard }
