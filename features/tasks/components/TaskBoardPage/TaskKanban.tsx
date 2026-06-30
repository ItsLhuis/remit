"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type ScreenReaderInstructions
} from "@dnd-kit/core"
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"

import { useTranslation } from "@/lib/i18n"

import { TASK_STATUS_VALUES, type TaskPriority, type TaskStatus } from "../../schemas"
import { type TaskItem } from "../../types"

import { TaskCardOverlay } from "./TaskCardOverlay"
import { TaskKanbanColumn } from "./TaskKanbanColumn"

type TaskColumns = Record<TaskStatus, TaskItem[]>

type TaskMoveInput = {
  id: string
  fromStatus: TaskStatus
  toStatus: TaskStatus
  toIndex: number
}

type TaskKanbanProps = {
  tasks: TaskItem[]
  locale: string
  projectId: string
  currency: string
  search: string
  priorities: TaskPriority[]
  onEdit: (task: TaskItem) => void
  onDelete: (task: TaskItem) => void
  onPersistMove: (input: TaskMoveInput) => Promise<boolean>
  onPersistCreate: (status: TaskStatus, title: string) => Promise<boolean>
}

function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUS_VALUES as readonly string[]).includes(value)
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

function findColumn(columns: TaskColumns, id: string): TaskStatus | null {
  if (isTaskStatus(id)) return id

  return TASK_STATUS_VALUES.find((status) => columns[status].some((task) => task.id === id)) ?? null
}

function createPendingTask({
  id,
  projectId,
  currency,
  status,
  title
}: {
  id: string
  projectId: string
  currency: string
  status: TaskStatus
  title: string
}): TaskItem {
  return {
    id,
    projectId,
    title,
    description: "",
    status,
    priority: "normal",
    dueAt: null,
    completedAt: null,
    position: Number.MAX_SAFE_INTEGER,
    hourlyRateCents: null,
    currency,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function removePendingId(pendingIds: Set<string>, id: string): Set<string> {
  const next = new Set(pendingIds)

  next.delete(id)

  return next
}

const TaskKanban = ({
  tasks,
  locale,
  projectId,
  currency,
  search,
  priorities,
  onEdit,
  onDelete,
  onPersistMove,
  onPersistCreate
}: TaskKanbanProps) => {
  const { t } = useTranslation()

  const [columns, setColumns] = useState<TaskColumns>(() => groupTasksByStatus(tasks))
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())

  const columnsRef = useRef(columns)
  const snapshotRef = useRef<TaskColumns | null>(null)

  const [previousTasks, setPreviousTasks] = useState(tasks)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (tasks !== previousTasks) {
    setPreviousTasks(tasks)
    setColumns(groupTasksByStatus(tasks))
    setPendingIds(new Set())
  }

  useEffect(() => {
    columnsRef.current = columns
  }, [columns])

  const visibleColumns = useMemo<TaskColumns>(() => {
    const term = search.trim().toLowerCase()

    const matches = (task: TaskItem) =>
      (priorities.length === 0 || priorities.includes(task.priority)) &&
      (term === "" || task.title.toLowerCase().includes(term))

    return Object.fromEntries(
      TASK_STATUS_VALUES.map((status) => [status, columns[status].filter(matches)])
    ) as TaskColumns
  }, [columns, search, priorities])

  const resolveColumnLabel = (id: string): string => {
    const status = findColumn(columnsRef.current, id)

    return status ? t(`tasks.status.${status}`) : ""
  }

  const resolveTitle = (id: string): string => {
    const status = findColumn(columnsRef.current, id)
    const task = status ? columnsRef.current[status].find((item) => item.id === id) : undefined

    return task?.title ?? ""
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("tasks.dnd.onDragStart", { title: resolveTitle(String(active.id)) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("tasks.dnd.onDragOver", {
            title: resolveTitle(String(active.id)),
            column: resolveColumnLabel(String(over.id))
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("tasks.dnd.onDragEnd", {
            title: resolveTitle(String(active.id)),
            column: resolveColumnLabel(String(over.id))
          })
        : undefined,
    onDragCancel: ({ active }) =>
      t("tasks.dnd.onDragCancel", { title: resolveTitle(String(active.id)) })
  }

  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: t("tasks.dnd.instructions")
  }

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    const status = findColumn(columnsRef.current, id)
    const task = status ? columnsRef.current[status].find((item) => item.id === id) : undefined

    snapshotRef.current = columnsRef.current

    setActiveTask(task ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId === overId) return

    const fromColumn = findColumn(columnsRef.current, activeId)
    const toColumn = findColumn(columnsRef.current, overId)

    if (!fromColumn || !toColumn || fromColumn === toColumn) return

    setColumns((previous) => {
      const fromItems = previous[fromColumn]
      const toItems = previous[toColumn]
      const activeIndex = fromItems.findIndex((task) => task.id === activeId)

      if (activeIndex === -1) return previous

      const moved = fromItems[activeIndex]
      const overIndex = isTaskStatus(overId)
        ? toItems.length
        : toItems.findIndex((task) => task.id === overId)
      const insertAt = overIndex === -1 ? toItems.length : overIndex

      return {
        ...previous,
        [fromColumn]: fromItems.filter((task) => task.id !== activeId),
        [toColumn]: [
          ...toItems.slice(0, insertAt),
          { ...moved, status: toColumn },
          ...toItems.slice(insertAt)
        ]
      }
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    const snapshot = snapshotRef.current

    snapshotRef.current = null

    setActiveTask(null)

    if (!snapshot) return

    const id = String(active.id)

    if (!over) {
      setColumns(snapshot)

      return
    }

    const overId = String(over.id)
    const activeColumn = findColumn(columnsRef.current, id)
    const overColumn = findColumn(columnsRef.current, overId)

    if (!activeColumn || !overColumn) {
      setColumns(snapshot)

      return
    }

    let finalColumns = columnsRef.current

    if (activeColumn === overColumn && !isTaskStatus(overId)) {
      const items = columnsRef.current[activeColumn]
      const oldIndex = items.findIndex((task) => task.id === id)
      const newIndex = items.findIndex((task) => task.id === overId)

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        finalColumns = {
          ...columnsRef.current,
          [activeColumn]: arrayMove(items, oldIndex, newIndex)
        }

        setColumns(finalColumns)
      }
    }

    const fromColumn = findColumn(snapshot, id)
    const finalColumn = findColumn(finalColumns, id)

    if (!fromColumn || !finalColumn) return

    const fromIndex = snapshot[fromColumn].findIndex((task) => task.id === id)
    const toIndex = finalColumns[finalColumn].findIndex((task) => task.id === id)

    if (fromColumn === finalColumn && fromIndex === toIndex) {
      setColumns(snapshot)

      return
    }

    const persisted = await onPersistMove({
      id,
      fromStatus: fromColumn,
      toStatus: finalColumn,
      toIndex
    })

    if (!persisted) setColumns(snapshot)
  }

  const handleDragCancel = () => {
    const snapshot = snapshotRef.current

    snapshotRef.current = null

    setActiveTask(null)

    if (snapshot) setColumns(snapshot)
  }

  const handleMenuChangeStatus = async (task: TaskItem, status: TaskStatus) => {
    if (task.status === status) return

    const snapshot = columnsRef.current
    const fromColumn = findColumn(snapshot, task.id)

    if (!fromColumn) return

    const toIndex = snapshot[status].length

    setColumns((previous) => ({
      ...previous,
      [fromColumn]: previous[fromColumn].filter((item) => item.id !== task.id),
      [status]: [...previous[status], { ...task, status }]
    }))

    const persisted = await onPersistMove({
      id: task.id,
      fromStatus: task.status,
      toStatus: status,
      toIndex
    })

    if (!persisted) setColumns(snapshot)
  }

  const handleCreate = async (status: TaskStatus, title: string): Promise<boolean> => {
    const tempId = `pending-${crypto.randomUUID()}`

    const tempTask = createPendingTask({ id: tempId, projectId, currency, status, title })

    setPendingIds((previous) => new Set(previous).add(tempId))
    setColumns((previous) => ({ ...previous, [status]: [...previous[status], tempTask] }))

    const created = await onPersistCreate(status, title)

    if (!created) {
      setColumns((previous) => ({
        ...previous,
        [status]: previous[status].filter((task) => task.id !== tempId)
      }))
    }

    setPendingIds((previous) => removePendingId(previous, tempId))

    return created
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-full min-h-0 gap-4 overflow-x-auto overflow-y-hidden pb-2">
        {TASK_STATUS_VALUES.map((status) => (
          <TaskKanbanColumn
            key={status}
            status={status}
            tasks={visibleColumns[status]}
            locale={locale}
            pendingIds={pendingIds}
            onEdit={onEdit}
            onDelete={onDelete}
            onChangeStatus={handleMenuChangeStatus}
            onCreate={handleCreate}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCardOverlay task={activeTask} locale={locale} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

export { TaskKanban }
