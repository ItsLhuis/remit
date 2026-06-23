"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import { useTranslation } from "@/lib/i18n"

import { Badge, Typography } from "@/components/ui"

import { type TaskStatus } from "../../schemas"
import { type TaskItem } from "../../types"
import { TaskStatusBadge } from "../TaskStatusBadge"

import { TaskCard } from "./TaskCard"

type TaskKanbanColumnProps = {
  status: TaskStatus
  tasks: TaskItem[]
  locale: string
  onChangeStatus: (taskId: string, status: TaskStatus) => void
  onMove: (taskId: string, toIndex: number) => void
  onEdit: (task: TaskItem) => void
  onDelete: (task: TaskItem) => void
}

const TaskKanbanColumn = ({
  status,
  tasks,
  locale,
  onChangeStatus,
  onMove,
  onEdit,
  onDelete
}: TaskKanbanColumnProps) => {
  const { t } = useTranslation()

  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="bg-muted/40 flex w-72 shrink-0 flex-col gap-3 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <TaskStatusBadge status={status} />
        <Badge variant="secondary" className="rounded-sm px-1.5 font-normal">
          {tasks.length}
        </Badge>
      </div>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-24 flex-col gap-2 rounded-md transition-colors ${
            isOver ? "bg-accent/40" : ""
          }`}
        >
          {tasks.length === 0 ? (
            <Typography affects={["muted", "tiny"]} className="p-3 text-center">
              {t("tasks.columns.empty")}
            </Typography>
          ) : (
            tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                locale={locale}
                index={index}
                count={tasks.length}
                onChangeStatus={onChangeStatus}
                onMove={onMove}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export { TaskKanbanColumn }
