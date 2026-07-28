"use client"

import { useDeferredValue, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCentsForInput } from "@/lib/utils"

import {
  Button,
  Icon,
  ScrollArea,
  SidebarTrigger,
  ToggleGroup,
  ToggleGroupItem,
  Typography,
  toast
} from "@/components/ui"

import { useTaskBoardState } from "../../hooks"
import { createTask, reorderTask, softDeleteTask, updateTaskStatus } from "../../mutations"
import { TASK_VIEW_VALUES, type TaskStatus } from "../../schemas"
import { type TaskBoardData, type TaskFormData, type TaskItem } from "../../types"
import { DeleteTaskDialog } from "../DeleteTaskDialog"
import { TaskFormSheet } from "../TaskFormSheet"

import { TaskBoardEmpty } from "./TaskBoardEmpty"
import { TaskBoardFilters } from "./TaskBoardFilters"
import { TaskKanban } from "./TaskKanban"
import { TaskTable } from "./TaskTable"

function toTaskFormData(task: TaskItem): TaskFormData {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "",
    hourlyRate: formatCentsForInput(task.hourlyRateCents)
  }
}

function isTaskView(value: string): value is (typeof TASK_VIEW_VALUES)[number] {
  return (TASK_VIEW_VALUES as readonly string[]).includes(value)
}

type TaskMoveInput = {
  id: string
  fromStatus: TaskStatus
  toStatus: TaskStatus
  toIndex: number
}

type TaskBoardPageProps = {
  data: TaskBoardData
}

const TaskBoardPage = ({ data }: TaskBoardPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const {
    view,
    setView,
    search,
    setSearch,
    priorities,
    togglePriority,
    setPriorities,
    clearFilters,
    hasActiveFilters
  } = useTaskBoardState()

  const deferredSearch = useDeferredValue(search)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTask, setEditTask] = useState<TaskItem | null>(null)
  const [deleteTask, setDeleteTask] = useState<TaskItem | null>(null)

  const [isDeleting, startDeleting] = useTransition()

  const locale = data.defaults.defaultLocale

  const persistMove = async ({
    id,
    fromStatus,
    toStatus,
    toIndex
  }: TaskMoveInput): Promise<boolean> => {
    if (fromStatus !== toStatus) {
      const statusResult = await updateTaskStatus({ id, status: toStatus })

      if ("error" in statusResult) {
        toast.error(statusResult.error)

        router.refresh()

        return false
      }
    }

    const reorderResult = await reorderTask({ id, toIndex })

    if ("error" in reorderResult) {
      toast.error(reorderResult.error)

      router.refresh()

      return false
    }

    router.refresh()

    return true
  }

  const persistCreate = async (status: TaskStatus, title: string): Promise<boolean> => {
    const result = await createTask({
      projectId: data.projectId,
      title,
      description: "",
      status,
      priority: "normal",
      dueDate: "",
      hourlyRate: ""
    })

    if ("error" in result) {
      toast.error(result.error)

      return false
    }

    router.refresh()

    return true
  }

  const handleChangeStatus = (taskId: string, status: TaskStatus) => {
    void (async () => {
      const result = await updateTaskStatus({ id: taskId, status })

      if ("error" in result) {
        toast.error(result.error)
      }

      router.refresh()
    })()
  }

  const handleConfirmDelete = () => {
    if (!deleteTask || isDeleting) return

    const taskId = deleteTask.id

    startDeleting(async () => {
      const result = await softDeleteTask({ id: taskId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("tasks.delete.deleted"))

      setDeleteTask(null)

      router.refresh()
    })
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-6 p-4 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href={`/projects/${data.projectId}`}>
            <Icon name="ArrowLeft" aria-hidden="true" />
            {t("tasks.board.backToProject")}
          </Link>
        </Button>
      </div>
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Icon
              name="ListTodo"
              className="text-muted-foreground size-6 shrink-0"
              aria-hidden="true"
            />
            <Typography variant="h2">{data.projectName}</Typography>
          </div>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            {t("tasks.board.count", { count: data.tasks.length })}
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => {
              if (isTaskView(value)) setView(value)
            }}
            aria-label={t("tasks.view.label")}
          >
            <ToggleGroupItem value="kanban">
              <Icon name="Columns3" aria-hidden="true" />
              {t("tasks.view.kanban")}
            </ToggleGroupItem>
            <ToggleGroupItem value="table">
              <Icon name="Table" aria-hidden="true" />
              {t("tasks.view.table")}
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="Plus" aria-hidden="true" />
            {t("tasks.board.createButton")}
          </Button>
        </div>
      </header>
      {view === "kanban" && data.tasks.length > 0 ? (
        <TaskBoardFilters
          search={search}
          onSearchChange={setSearch}
          priorities={priorities}
          onTogglePriority={togglePriority}
          onClearPriorities={() => setPriorities([])}
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearFilters}
        />
      ) : null}
      <div className="min-h-0 flex-1">
        {data.tasks.length === 0 ? (
          <TaskBoardEmpty onCreate={() => setCreateOpen(true)} />
        ) : view === "table" ? (
          <ScrollArea orientation="both" className="h-full">
            <TaskTable
              tasks={data.tasks}
              locale={locale}
              onChangeStatus={handleChangeStatus}
              onEdit={setEditTask}
              onDelete={setDeleteTask}
            />
          </ScrollArea>
        ) : (
          <TaskKanban
            tasks={data.tasks}
            locale={locale}
            projectId={data.projectId}
            currency={data.currency}
            search={deferredSearch}
            priorities={priorities}
            onEdit={setEditTask}
            onDelete={setDeleteTask}
            onPersistMove={persistMove}
            onPersistCreate={persistCreate}
          />
        )}
      </div>
      <TaskFormSheet
        mode="create"
        projectId={data.projectId}
        currency={data.currency}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => router.refresh()}
      />
      {editTask ? (
        <TaskFormSheet
          mode="edit"
          task={toTaskFormData(editTask)}
          currency={data.currency}
          open={editTask !== null}
          onOpenChange={(open) => {
            if (!open) setEditTask(null)
          }}
          onSuccess={() => router.refresh()}
        />
      ) : null}
      <DeleteTaskDialog
        open={deleteTask !== null}
        isDeleting={isDeleting}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTask(null)
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export { TaskBoardPage }
