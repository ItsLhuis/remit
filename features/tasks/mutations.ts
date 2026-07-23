"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { database } from "@/database"
import { projects, tasks } from "@/database/schema"

import { emitTaskCreated, emitTaskDeleted, emitTaskStatusChanged, emitTaskUpdated } from "./events"
import { getTaskForEdit } from "./queries"
import {
  createTaskSchema,
  reorderTaskSchema,
  taskIdSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  type CreateTaskValues,
  type UpdateTaskValues
} from "./schemas"
import { canTransitionTaskStatus, getInitialTaskPosition, planTaskReorder } from "./services"
import { type TaskFormData } from "./types"

export type TaskMutationResult = { data: { task: TaskFormData } } | { error: string }

export type DeleteTaskResult = { data: { id: string } } | { error: string }

type TaskWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type TaskWriteGate = { context: TaskWriteContext } | { error: string }

type TaskAuditEvent = "task.created" | "task.updated" | "task.deleted" | "task.status_changed"

type TaskWriteValues = {
  title: string
  description: string | null
  status: CreateTaskValues["status"]
  priority: CreateTaskValues["priority"]
  dueAt: Date | null
  hourlyRateCents: number | null
}

const AUDIT_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "dueAt",
  "hourlyRateCents"
] as const

export async function createTask(input: unknown): Promise<TaskMutationResult> {
  const gate = await requireTaskWrite()

  if ("error" in gate) return gate

  const parsed = createTaskSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const project = await database.query.projects.findFirst({
      where: and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)),
      columns: { id: true }
    })

    if (!project) throw new ExpectedTaskError(t("tasks.errors.projectNotFound"))

    const writeValues = toTaskWriteValues(parsed.data)
    const position = await getNextColumnPosition(project.id, writeValues.status)

    const [createdTask] = await database
      .insert(tasks)
      .values({
        projectId: project.id,
        title: writeValues.title,
        description: writeValues.description,
        status: writeValues.status,
        priority: writeValues.priority,
        dueAt: writeValues.dueAt,
        completedAt: writeValues.status === "done" ? new Date() : null,
        position,
        hourlyRateCents: writeValues.hourlyRateCents
      })
      .returning({ id: tasks.id })

    if (!createdTask) throw new Error("Task insert returned no row")

    await writeTaskAudit(context, "task.created", createdTask.id, {
      projectId: project.id,
      status: writeValues.status
    })
    await emitTaskCreated({ taskId: createdTask.id, projectId: project.id, userId: context.userId })

    revalidateTaskPaths(project.id)

    return await loadTaskResult(createdTask.id)
  } catch (error) {
    return handleTaskActionError(error, "createTask", context.userId)
  }
}

export async function updateTask(input: unknown): Promise<TaskMutationResult> {
  const gate = await requireTaskWrite()

  if ("error" in gate) return gate

  const parsed = updateTaskSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.tasks.findFirst({
      where: and(eq(tasks.id, parsed.data.id), isNull(tasks.deletedAt))
    })

    if (!existing) throw new ExpectedTaskError(t("tasks.errors.notFound"))

    const writeValues = toTaskWriteValues(parsed.data)
    const completedAt = writeValues.status === "done" ? (existing.completedAt ?? new Date()) : null

    const [updatedTask] = await database
      .update(tasks)
      .set({
        title: writeValues.title,
        description: writeValues.description,
        status: writeValues.status,
        priority: writeValues.priority,
        dueAt: writeValues.dueAt,
        hourlyRateCents: writeValues.hourlyRateCents,
        completedAt
      })
      .where(and(eq(tasks.id, parsed.data.id), isNull(tasks.deletedAt)))
      .returning({ id: tasks.id, projectId: tasks.projectId })

    if (!updatedTask) throw new ExpectedTaskError(t("tasks.errors.notFound"))

    const changedFields = getChangedTaskFields(existing, writeValues)

    await writeTaskAudit(context, "task.updated", updatedTask.id, {
      projectId: updatedTask.projectId,
      changedFields
    })
    await emitTaskUpdated({
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: context.userId,
      changedFields
    })

    revalidateTaskPaths(updatedTask.projectId)

    return await loadTaskResult(updatedTask.id)
  } catch (error) {
    return handleTaskActionError(error, "updateTask", context.userId, parsed.data.id)
  }
}

export async function updateTaskStatus(input: unknown): Promise<TaskMutationResult> {
  const gate = await requireTaskWrite()

  if ("error" in gate) return gate

  const parsed = updateTaskStatusSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.tasks.findFirst({
      where: and(eq(tasks.id, parsed.data.id), isNull(tasks.deletedAt))
    })

    if (!existing) throw new ExpectedTaskError(t("tasks.errors.notFound"))

    const transition = canTransitionTaskStatus(existing.status, parsed.data.status)

    if (!transition.allowed) throw new ExpectedTaskError(t("tasks.errors.invalidTransition"))

    const position = await getNextColumnPosition(existing.projectId, transition.nextStatus)

    const [updatedTask] = await database
      .update(tasks)
      .set({
        status: transition.nextStatus,
        position,
        completedAt: transition.nextStatus === "done" ? new Date() : null
      })
      .where(and(eq(tasks.id, parsed.data.id), isNull(tasks.deletedAt)))
      .returning({ id: tasks.id, projectId: tasks.projectId, status: tasks.status })

    if (!updatedTask) throw new ExpectedTaskError(t("tasks.errors.notFound"))

    await writeTaskAudit(context, "task.status_changed", updatedTask.id, {
      projectId: updatedTask.projectId,
      from: existing.status,
      to: updatedTask.status
    })
    await emitTaskStatusChanged({
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: context.userId,
      from: existing.status,
      to: updatedTask.status
    })

    revalidateTaskPaths(updatedTask.projectId)

    return await loadTaskResult(updatedTask.id)
  } catch (error) {
    return handleTaskActionError(error, "updateTaskStatus", context.userId, parsed.data.id)
  }
}

export async function reorderTask(input: unknown): Promise<TaskMutationResult> {
  const gate = await requireTaskWrite()

  if ("error" in gate) return gate

  const parsed = reorderTaskSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.tasks.findFirst({
      where: and(eq(tasks.id, parsed.data.id), isNull(tasks.deletedAt))
    })

    if (!existing) throw new ExpectedTaskError(t("tasks.errors.notFound"))

    const siblings = await database
      .select({ id: tasks.id, position: tasks.position })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, existing.projectId),
          eq(tasks.status, existing.status),
          isNull(tasks.deletedAt)
        )
      )
      .orderBy(asc(tasks.position), asc(tasks.createdAt))

    const updates = planTaskReorder(siblings, existing.id, parsed.data.toIndex)

    if (updates.length > 0) {
      // One statement with a CASE rather than a loop of updates: `planTaskReorder` may return a
      // full repack of the column, and applying those row by row would leave the board in states
      // where two tasks briefly share a position or only half the column has been renumbered.
      await database
        .update(tasks)
        .set({
          position: sql`CASE ${sql.join(
            updates.map(
              (update) =>
                sql`WHEN ${tasks.id} = ${update.id}::uuid THEN ${update.position}::integer`
            ),
            sql` `
          )} END`
        })
        .where(
          inArray(
            tasks.id,
            updates.map((update) => update.id)
          )
        )
    }

    await writeTaskAudit(context, "task.updated", existing.id, {
      projectId: existing.projectId,
      reordered: true,
      toIndex: parsed.data.toIndex
    })

    revalidateTaskPaths(existing.projectId)

    return await loadTaskResult(existing.id)
  } catch (error) {
    return handleTaskActionError(error, "reorderTask", context.userId, parsed.data.id)
  }
}

export async function softDeleteTask(input: unknown): Promise<DeleteTaskResult> {
  const gate = await requireTaskDelete()

  if ("error" in gate) return gate

  const parsed = taskIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deletedTask] = await database
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(and(eq(tasks.id, parsed.data.id), isNull(tasks.deletedAt)))
      .returning({ id: tasks.id, projectId: tasks.projectId })

    if (!deletedTask) throw new ExpectedTaskError(t("tasks.errors.notFound"))

    await writeTaskAudit(context, "task.deleted", deletedTask.id, {
      projectId: deletedTask.projectId,
      softDeleted: true
    })
    await emitTaskDeleted({
      taskId: deletedTask.id,
      projectId: deletedTask.projectId,
      userId: context.userId
    })

    revalidateTaskPaths(deletedTask.projectId)

    return { data: { id: deletedTask.id } }
  } catch (error) {
    return handleTaskActionError(error, "softDeleteTask", context.userId, parsed.data.id)
  }
}

async function getNextColumnPosition(
  projectId: string,
  status: CreateTaskValues["status"]
): Promise<number> {
  const rows = await database
    .select({ position: tasks.position })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.status, status), isNull(tasks.deletedAt)))

  return getInitialTaskPosition(rows.map((row) => row.position))
}

async function loadTaskResult(taskId: string): Promise<TaskMutationResult> {
  const task = await getTaskForEdit({ id: taskId })

  if (!task) throw new ExpectedTaskError(t("tasks.errors.notFound"))

  return { data: { task } }
}

async function requireTaskWrite(): Promise<TaskWriteGate> {
  const gate = await getTaskActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner" && gate.context.role !== "assistant") {
    return { error: t("errors.forbidden") }
  }

  return gate
}

async function requireTaskDelete(): Promise<TaskWriteGate> {
  const gate = await getTaskActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner") return { error: t("errors.forbidden") }

  return gate
}

async function getTaskActionContext(): Promise<TaskWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (!isRole(role)) return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

async function writeTaskAudit(
  context: TaskWriteContext,
  event: TaskAuditEvent,
  taskId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "task",
    targetEntityId: taskId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function toTaskWriteValues(values: CreateTaskValues | UpdateTaskValues): TaskWriteValues {
  return {
    title: values.title,
    description: emptyToNull(values.description),
    status: values.status,
    priority: values.priority,
    dueAt: values.dueDate,
    hourlyRateCents: values.hourlyRate
  }
}

function getChangedTaskFields(
  existing: typeof tasks.$inferSelect,
  next: TaskWriteValues
): string[] {
  return AUDIT_FIELDS.filter((field) => !isSameValue(existing[field], next[field]))
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()

  if (a instanceof Date || b instanceof Date) return false

  return (a ?? null) === (b ?? null)
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function revalidateTaskPaths(projectId: string): void {
  revalidatePath(`/projects/${projectId}/tasks`)
  revalidatePath(`/projects/${projectId}`)
}

function handleTaskActionError(
  error: unknown,
  action: string,
  userId: string | null,
  taskId?: string
): { error: string } {
  if (error instanceof ExpectedTaskError) return { error: error.message }

  logger.error({ action, userId, taskId, err: error }, "Task action failed")

  return { error: t("tasks.errors.updateFailed") }
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}

class ExpectedTaskError extends Error {}
