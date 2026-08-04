"use client"

import { CollisionPriority } from "@dnd-kit/abstract"
import { useDroppable } from "@dnd-kit/react"

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
  // The column must lose every collision it shares with a card: `TaskCard`'s sortable is left at
  // dnd-kit's default priority, so `Low` here is what makes a drop over a populated column resolve
  // to the card under the pointer and reorder, rather than being swallowed by the column and
  // appended. The column still wins when nothing else collides, which is how an empty one accepts.
  const { ref, isDropTarget } = useDroppable({
    id: status,
    type: "column",
    accept: "item",
    collisionPriority: CollisionPriority.Low
  })

  return (
    <Card className="flex h-full w-80 shrink-0 flex-col gap-0 py-0">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
        <TaskStatusBadge status={status} />
        <Badge variant="secondary" className="rounded-sm px-1.5 font-normal tabular-nums">
          {tasks.length}
        </Badge>
      </div>
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-3">
        <div
          className={cn(
            "flex min-h-full flex-col gap-2 rounded-lg pb-3 transition-colors",
            isDropTarget && "bg-primary/5 ring-primary/30 ring-1"
          )}
        >
          {tasks.length === 0 ? (
            <TaskColumnEmpty />
          ) : (
            tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                locale={locale}
                isPending={pendingIds.has(task.id)}
                onEdit={onEdit}
                onDelete={onDelete}
                onChangeStatus={onChangeStatus}
              />
            ))
          )}
        </div>
      </div>
      <div className="border-border/60 shrink-0 border-t p-2">
        <TaskQuickAdd onCreate={(title) => onCreate(status, title)} />
      </div>
    </Card>
  )
}

export { TaskKanbanColumn }
