"use client"

import { useEffect, useState } from "react"

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core"
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"

import { TASK_STATUS_VALUES, type TaskStatus } from "../../schemas"
import { type TaskItem } from "../../types"

import { TaskKanbanColumn } from "./TaskKanbanColumn"

type TaskColumns = Record<TaskStatus, TaskItem[]>

type TaskKanbanProps = {
  tasks: TaskItem[]
  locale: string
  onChangeStatus: (taskId: string, status: TaskStatus) => void
  onMove: (taskId: string, toIndex: number) => void
  onEdit: (task: TaskItem) => void
  onDelete: (task: TaskItem) => void
}

function groupTasksByStatus(tasks: TaskItem[]): TaskColumns {
  const columns = Object.fromEntries(
    TASK_STATUS_VALUES.map((status) => [status, [] as TaskItem[]])
  ) as TaskColumns

  for (const task of tasks) {
    columns[task.status].push(task)
  }

  return columns
}

function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUS_VALUES as readonly string[]).includes(value)
}

const TaskKanban = ({
  tasks,
  locale,
  onChangeStatus,
  onMove,
  onEdit,
  onDelete
}: TaskKanbanProps) => {
  const [columns, setColumns] = useState<TaskColumns>(() => groupTasksByStatus(tasks))

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    setColumns(groupTasksByStatus(tasks))
  }, [tasks])

  const findColumn = (id: string): TaskStatus | null => {
    if (isTaskStatus(id)) return id

    return (
      TASK_STATUS_VALUES.find((status) => columns[status].some((task) => task.id === id)) ?? null
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const from = findColumn(activeId)
    const to = findColumn(overId)

    if (!from || !to) return

    if (from === to) {
      const column = columns[from]
      const oldIndex = column.findIndex((task) => task.id === activeId)
      const newIndex = isTaskStatus(overId)
        ? column.length - 1
        : column.findIndex((task) => task.id === overId)

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      setColumns((previous) => ({
        ...previous,
        [from]: arrayMove(previous[from], oldIndex, newIndex)
      }))

      onMove(activeId, newIndex)

      return
    }

    const moved = columns[from].find((task) => task.id === activeId)

    if (!moved) return

    setColumns((previous) => {
      const overIndex = isTaskStatus(overId)
        ? previous[to].length
        : previous[to].findIndex((task) => task.id === overId)
      const insertAt = overIndex === -1 ? previous[to].length : overIndex

      return {
        ...previous,
        [from]: previous[from].filter((task) => task.id !== activeId),
        [to]: [
          ...previous[to].slice(0, insertAt),
          { ...moved, status: to },
          ...previous[to].slice(insertAt)
        ]
      }
    })

    onChangeStatus(activeId, to)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TASK_STATUS_VALUES.map((status) => (
          <TaskKanbanColumn
            key={status}
            status={status}
            tasks={columns[status]}
            locale={locale}
            onChangeStatus={onChangeStatus}
            onMove={onMove}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </DndContext>
  )
}

export { TaskKanban }
