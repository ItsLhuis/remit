import { and, asc, eq, isNull } from "drizzle-orm"

import { formatCentsForInput } from "@/lib/utils"

import { database } from "@/database"
import { projects, tasks } from "@/database/schema"

import { taskBoardParamsSchema, taskIdSchema } from "./schemas"
import { type TaskBoardData, type TaskDefaults, type TaskFormData, type TaskItem } from "./types"

const taskColumns = {
  id: tasks.id,
  projectId: tasks.projectId,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  dueAt: tasks.dueAt,
  completedAt: tasks.completedAt,
  position: tasks.position,
  hourlyRateCents: tasks.hourlyRateCents,
  currency: projects.currency,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt
}

type TaskRow = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: TaskItem["status"]
  priority: TaskItem["priority"]
  dueAt: Date | null
  completedAt: Date | null
  position: number
  hourlyRateCents: number | null
  currency: string | null
  createdAt: Date
  updatedAt: Date
}

export async function getTaskDefaults(): Promise<TaskDefaults> {
  const row = await database.query.settings.findFirst({
    columns: {
      defaultCurrency: true,
      defaultLocale: true
    }
  })

  return {
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en"
  }
}

export async function listTasksByProject(
  projectId: string,
  defaultCurrency = "EUR"
): Promise<TaskItem[]> {
  const rows = await database
    .select(taskColumns)
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.status), asc(tasks.position), asc(tasks.createdAt))

  return rows.map((row) => toTaskItem(row, defaultCurrency))
}

export async function getTaskBoardData(input: unknown): Promise<TaskBoardData | null> {
  const parsed = taskBoardParamsSchema.safeParse(input)

  if (!parsed.success) return null

  const project = await database.query.projects.findFirst({
    where: and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)),
    columns: { id: true, name: true, currency: true }
  })

  if (!project) return null

  const defaults = await getTaskDefaults()
  const currency = project.currency ?? defaults.defaultCurrency
  const taskList = await listTasksByProject(project.id, currency)

  return {
    projectId: project.id,
    projectName: project.name,
    currency,
    tasks: taskList,
    defaults
  }
}

export async function getTaskForEdit(input: unknown): Promise<TaskFormData | null> {
  const parsed = taskIdSchema.safeParse(input)

  if (!parsed.success) return null

  const task = await database.query.tasks.findFirst({
    where: and(eq(tasks.id, parsed.data.id), isNull(tasks.deletedAt))
  })

  if (!task) return null

  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    dueDate: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "",
    hourlyRate: formatCentsForInput(task.hourlyRateCents)
  }
}

function toTaskItem(row: TaskRow, defaultCurrency: string): TaskItem {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    priority: row.priority,
    dueAt: row.dueAt,
    completedAt: row.completedAt,
    position: row.position,
    hourlyRateCents: row.hourlyRateCents ?? null,
    currency: row.currency ?? defaultCurrency,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}
