"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import { cn } from "@/lib/utils"

import { Badge, Card } from "@/components/ui"

import { type TaskStatus } from "../../schemas"
import { type TaskItem } from "../../types"
import { TaskStatusBadge } from "../TaskStatusBadge"

import { TaskCard } from "./TaskCard"
import { TaskColumnEmpty } from "./TaskColumnEmpty"
import { TaskQuickAdd } from "./TaskQuickAdd"

type TaskKanbanColumnProps = {
  status: TaskStatus
  tasks: TaskItem[]
  locale: string
  pendingIds: Set<string>
  onEdit: (task: TaskItem) => void
  onDelete: (task: TaskItem) => void
  onChangeStatus: (task: TaskItem, status: TaskStatus) => void
  onCreate: (status: TaskStatus, title: string) => Promise<boolean>
}

const TaskKanbanColumn = ({
  status,
  tasks,
  locale,
  pendingIds,
  onEdit,
  onDelete,
  onChangeStatus,
  onCreate
}: TaskKanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <Card className="flex h-full w-80 shrink-0 flex-col gap-0 py-0">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
        <TaskStatusBadge status={status} />
        <Badge variant="secondary" className="rounded-sm px-1.5 font-normal tabular-nums">
          {tasks.length}
        </Badge>
      </div>
      <div ref={setNodeRef} className="min-h-0 flex-1 overflow-y-auto px-3">
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            className={cn(
              "flex min-h-full flex-col gap-2 rounded-lg pb-3 transition-colors",
              isOver && "bg-primary/5 ring-primary/30 ring-1"
            )}
          >
            {tasks.length === 0 ? (
              <TaskColumnEmpty />
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  locale={locale}
                  isPending={pendingIds.has(task.id)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onChangeStatus={onChangeStatus}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
      <div className="border-border/60 shrink-0 border-t p-2">
        <TaskQuickAdd onCreate={(title) => onCreate(status, title)} />
      </div>
    </Card>
  )
}

export { TaskKanbanColumn }
