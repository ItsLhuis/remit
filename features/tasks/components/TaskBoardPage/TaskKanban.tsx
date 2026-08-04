"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { type Plugins } from "@dnd-kit/abstract"
import {
  Accessibility,
  Feedback,
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor
} from "@dnd-kit/dom"
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from "@dnd-kit/react"

import { useTranslation } from "@/lib/i18n"

import { TASK_STATUS_VALUES, type TaskPriority, type TaskStatus } from "../../schemas"
import { type TaskItem } from "../../types"

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

function resolveTitle(columns: TaskColumns, id: string): string {
  const status = findColumn(columns, id)
  const task = status ? columns[status].find((item) => item.id === id) : undefined

  return task?.title ?? ""
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  const [moved] = next.splice(from, 1)

  if (!moved) return items

  next.splice(to, 0, moved)

  return next
}

const sensors = [
  PointerSensor.configure({
    activationConstraints: [new PointerActivationConstraints.Distance({ value: 8 })]
  }),
  KeyboardSensor
]

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
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())

  // The plugin factory is memoized on `t` alone and the drag handlers run outside React's render,
  // so both would close over whichever `columns` existed when they were created. Everything that
  // reads the board mid-gesture goes through this ref instead.
  const columnsRef = useRef(columns)
  const snapshotRef = useRef<TaskColumns | null>(null)

  // Adjusting state during render rather than in an effect, which is React's documented way to
  // reset derived state when a prop changes. An effect would paint one frame of the old board after
  // a server refresh — long enough to see a card the write already moved snap back — and would also
  // fight the optimistic updates the drag handlers below apply.
  const [previousTasks, setPreviousTasks] = useState(tasks)

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

  const plugins = useMemo(
    () => (defaults: Plugins) => {
      const columnLabel = (id: string): string => {
        const status = findColumn(columnsRef.current, id)

        return status ? t(`tasks.status.${status}`) : ""
      }

      // The stock Accessibility plugin has to be filtered out before the configured one is added:
      // dnd-kit installs both if it is left in, and the board then announces every drag twice, in
      // dnd-kit's own English on top of the translated announcements below.
      return [
        ...defaults.filter((plugin) => plugin !== Accessibility),
        Feedback.configure({ dropAnimation: null }),
        Accessibility.configure({
          announcements: {
            dragstart: (event: DragStartEvent) =>
              t("tasks.dnd.onDragStart", {
                title: resolveTitle(columnsRef.current, String(event.operation.source?.id))
              }),
            dragover: (event: DragOverEvent) =>
              event.operation.target
                ? t("tasks.dnd.onDragOver", {
                    title: resolveTitle(columnsRef.current, String(event.operation.source?.id)),
                    column: columnLabel(String(event.operation.target.id))
                  })
                : undefined,
            dragend: (event: DragEndEvent) =>
              event.canceled
                ? t("tasks.dnd.onDragCancel", {
                    title: resolveTitle(columnsRef.current, String(event.operation.source?.id))
                  })
                : event.operation.target
                  ? t("tasks.dnd.onDragEnd", {
                      title: resolveTitle(columnsRef.current, String(event.operation.source?.id)),
                      column: columnLabel(String(event.operation.target.id))
                    })
                  : undefined
          },
          screenReaderInstructions: { draggable: t("tasks.dnd.instructions") }
        })
      ]
    },
    [t]
  )

  const handleDragStart = () => {
    snapshotRef.current = columnsRef.current
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { source, target } = event.operation

    if (!source || !target) return

    const activeId = String(source.id)
    const overId = String(target.id)

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
    const snapshot = snapshotRef.current

    snapshotRef.current = null

    if (!snapshot) return

    if (event.canceled) {
      setColumns(snapshot)

      return
    }

    const { source, target } = event.operation

    if (!source) return

    const id = String(source.id)

    if (!target) {
      setColumns(snapshot)

      return
    }

    const overId = String(target.id)
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
          [activeColumn]: moveItem(items, oldIndex, newIndex)
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
    <DragDropProvider
      sensors={sensors}
      plugins={plugins}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
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
    </DragDropProvider>
  )
}

export { TaskKanban }
