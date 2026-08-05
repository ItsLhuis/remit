"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { database } from "@/database"
import { clients, projects, tasks, timeEntries } from "@/database/schema"

import { emitTimeLogged } from "./events"
import { getTimeEntryForEdit } from "./queries"
import {
  createManualTimeEntrySchema,
  startTimerSchema,
  timeEntryIdSchema,
  updateTimeEntrySchema,
  type CreateManualTimeEntryValues,
  type StartTimerValues,
  type UpdateTimeEntryValues
} from "./schemas"
import { computeDurationSeconds, resolveHourlyRate, type ResolvedHourlyRate } from "./services"
import { type TimeEntryFormData } from "./types"

export type TimeEntryMutationResult = { data: { entry: TimeEntryFormData } } | { error: string }

export type TimerMutationResult = { data: { id: string } } | { error: string }

export type DeleteTimeEntryResult = { data: { id: string } } | { error: string }

type TimeEntryWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type TimeEntryWriteGate = { context: TimeEntryWriteContext } | { error: string }

type TimeEntryAuditEvent =
  | "time_entry.timer_started"
  | "time_entry.timer_stopped"
  | "time_entry.created"
  | "time_entry.updated"
  | "time_entry.deleted"

type RateContext = {
  projectId: string
  taskId: string | null
  resolved: ResolvedHourlyRate
}

const timeTrackingPath = "/time"

export async function startTimer(input: unknown): Promise<TimerMutationResult> {
  const gate = await requireTimeEntryWrite()

  if ("error" in gate) return gate

  const parsed = startTimerSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const running = await database.query.timeEntries.findFirst({
      where: and(
        eq(timeEntries.userId, context.userId),
        isNull(timeEntries.endedAt),
        isNull(timeEntries.deletedAt)
      ),
      columns: { id: true }
    })

    // The product rule is one running timer per user. This check is what produces a message the
    // freelancer can act on; `time_entries_running_timer_idx` is what makes the rule hold when two
    // start requests race, since both would read "none running" before either inserts.
    if (running) return { error: t("timeTracking.errors.timerAlreadyRunning") }

    const rate = await resolveEntryRate(parsed.data)

    const [created] = await database
      .insert(timeEntries)
      .values({
        projectId: rate.projectId,
        taskId: rate.taskId,
        userId: context.userId,
        startedAt: new Date(),
        endedAt: null,
        durationSeconds: null,
        billable: parsed.data.billable,
        hourlyRateOverrideCents: parsed.data.hourlyRate,
        hourlyRateSnapshotCents: rate.resolved.rateCents,
        description: parsed.data.description || null,
        source: "timer"
      })
      .returning({ id: timeEntries.id })

    if (!created) throw new Error("Time entry insert returned no row")

    await writeTimeEntryAudit(context, "time_entry.timer_started", created.id, {
      projectId: rate.projectId,
      taskId: rate.taskId,
      rateSource: rate.resolved.source
    })

    revalidatePath(timeTrackingPath)

    return { data: { id: created.id } }
  } catch (error) {
    return handleTimeEntryError(error, "startTimer", context.userId)
  }
}

export async function stopTimer(input: unknown): Promise<TimerMutationResult> {
  const gate = await requireTimeEntryWrite()

  if ("error" in gate) return gate

  const parsed = timeEntryIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const running = await database.query.timeEntries.findFirst({
      where: and(
        eq(timeEntries.id, parsed.data.id),
        eq(timeEntries.userId, context.userId),
        isNull(timeEntries.endedAt),
        isNull(timeEntries.deletedAt)
      )
    })

    if (!running) throw new ExpectedTimeEntryError(t("timeTracking.errors.timerNotRunning"))

    const endedAt = new Date()
    const durationSeconds = computeDurationSeconds(running.startedAt, endedAt)

    if (durationSeconds === null) {
      throw new ExpectedTimeEntryError(t("timeTracking.errors.endBeforeStart"))
    }

    const [stopped] = await database
      .update(timeEntries)
      .set({ endedAt, durationSeconds })
      .where(and(eq(timeEntries.id, running.id), isNull(timeEntries.endedAt)))
      .returning({ id: timeEntries.id })

    if (!stopped) throw new ExpectedTimeEntryError(t("timeTracking.errors.timerNotRunning"))

    await writeTimeEntryAudit(context, "time_entry.timer_stopped", stopped.id, {
      projectId: running.projectId,
      durationSeconds
    })
    await emitTimeLogged({
      timeEntryId: stopped.id,
      projectId: running.projectId,
      taskId: running.taskId,
      userId: context.userId,
      durationSeconds,
      billable: running.billable
    })

    revalidatePath(timeTrackingPath)

    return { data: { id: stopped.id } }
  } catch (error) {
    return handleTimeEntryError(error, "stopTimer", context.userId, parsed.data.id)
  }
}

export async function createManualTimeEntry(input: unknown): Promise<TimeEntryMutationResult> {
  const gate = await requireTimeEntryWrite()

  if ("error" in gate) return gate

  const parsed = createManualTimeEntrySchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const durationSeconds = requireDurationSeconds(parsed.data.startedAt, parsed.data.endedAt)
    const rate = await resolveEntryRate(parsed.data)

    const [created] = await database
      .insert(timeEntries)
      .values({
        projectId: rate.projectId,
        taskId: rate.taskId,
        userId: context.userId,
        startedAt: parsed.data.startedAt,
        endedAt: parsed.data.endedAt,
        durationSeconds,
        billable: parsed.data.billable,
        hourlyRateOverrideCents: parsed.data.hourlyRate,
        hourlyRateSnapshotCents: rate.resolved.rateCents,
        description: parsed.data.description || null,
        source: "manual"
      })
      .returning({ id: timeEntries.id })

    if (!created) throw new Error("Time entry insert returned no row")

    await writeTimeEntryAudit(context, "time_entry.created", created.id, {
      projectId: rate.projectId,
      taskId: rate.taskId,
      durationSeconds,
      rateSource: rate.resolved.source
    })
    await emitTimeLogged({
      timeEntryId: created.id,
      projectId: rate.projectId,
      taskId: rate.taskId,
      userId: context.userId,
      durationSeconds,
      billable: parsed.data.billable
    })

    revalidatePath(timeTrackingPath)

    return await loadTimeEntryResult(created.id)
  } catch (error) {
    return handleTimeEntryError(error, "createManualTimeEntry", context.userId)
  }
}

export async function updateTimeEntry(input: unknown): Promise<TimeEntryMutationResult> {
  const gate = await requireTimeEntryWrite()

  if ("error" in gate) return gate

  const parsed = updateTimeEntrySchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.timeEntries.findFirst({
      where: and(eq(timeEntries.id, parsed.data.id), isNull(timeEntries.deletedAt)),
      columns: { id: true, invoicedInId: true, endedAt: true }
    })

    if (!existing) throw new ExpectedTimeEntryError(t("timeTracking.errors.notFound"))

    // An invoiced entry is frozen: its hours and rate are what a sent invoice line was built from,
    // so editing it here would move a receivable without the invoice ever changing.
    if (existing.invoicedInId) {
      throw new ExpectedTimeEntryError(t("timeTracking.errors.alreadyInvoiced"))
    }

    if (!existing.endedAt) throw new ExpectedTimeEntryError(t("timeTracking.errors.timerRunning"))

    const durationSeconds = requireDurationSeconds(parsed.data.startedAt, parsed.data.endedAt)
    const rate = await resolveEntryRate(parsed.data)

    const [updated] = await database
      .update(timeEntries)
      .set({
        projectId: rate.projectId,
        taskId: rate.taskId,
        startedAt: parsed.data.startedAt,
        endedAt: parsed.data.endedAt,
        durationSeconds,
        billable: parsed.data.billable,
        hourlyRateOverrideCents: parsed.data.hourlyRate,
        hourlyRateSnapshotCents: rate.resolved.rateCents,
        description: parsed.data.description || null
      })
      .where(and(eq(timeEntries.id, parsed.data.id), isNull(timeEntries.deletedAt)))
      .returning({ id: timeEntries.id })

    if (!updated) throw new ExpectedTimeEntryError(t("timeTracking.errors.notFound"))

    await writeTimeEntryAudit(context, "time_entry.updated", updated.id, {
      projectId: rate.projectId,
      taskId: rate.taskId,
      durationSeconds,
      rateSource: rate.resolved.source
    })

    revalidatePath(timeTrackingPath)

    return await loadTimeEntryResult(updated.id)
  } catch (error) {
    return handleTimeEntryError(error, "updateTimeEntry", context.userId, parsed.data.id)
  }
}

export async function softDeleteTimeEntry(input: unknown): Promise<DeleteTimeEntryResult> {
  const gate = await requireTimeEntryDelete()

  if ("error" in gate) return gate

  const parsed = timeEntryIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.timeEntries.findFirst({
      where: and(eq(timeEntries.id, parsed.data.id), isNull(timeEntries.deletedAt)),
      columns: { id: true, projectId: true, invoicedInId: true }
    })

    if (!existing) throw new ExpectedTimeEntryError(t("timeTracking.errors.notFound"))

    if (existing.invoicedInId) {
      throw new ExpectedTimeEntryError(t("timeTracking.errors.alreadyInvoiced"))
    }

    const [deleted] = await database
      .update(timeEntries)
      .set({ deletedAt: new Date() })
      .where(and(eq(timeEntries.id, parsed.data.id), isNull(timeEntries.deletedAt)))
      .returning({ id: timeEntries.id })

    if (!deleted) throw new ExpectedTimeEntryError(t("timeTracking.errors.notFound"))

    await writeTimeEntryAudit(context, "time_entry.deleted", deleted.id, {
      projectId: existing.projectId,
      softDeleted: true
    })

    revalidatePath(timeTrackingPath)

    return { data: { id: deleted.id } }
  } catch (error) {
    return handleTimeEntryError(error, "softDeleteTimeEntry", context.userId, parsed.data.id)
  }
}

async function requireTimeEntryWrite(): Promise<TimeEntryWriteGate> {
  const gate = await getTimeEntryActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner" && gate.context.role !== "assistant") {
    return { error: t("errors.forbidden") }
  }

  return gate
}

async function requireTimeEntryDelete(): Promise<TimeEntryWriteGate> {
  const gate = await getTimeEntryActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner") return { error: t("errors.forbidden") }

  return gate
}

async function getTimeEntryActionContext(): Promise<TimeEntryWriteGate> {
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

type RateInput = Pick<
  StartTimerValues | CreateManualTimeEntryValues | UpdateTimeEntryValues,
  "projectId" | "taskId" | "hourlyRate"
>

// Reads all four rungs below the entry and hands them to the pure service, which owns the
// precedence. The rate this returns is snapshotted onto the row at write time and never
// recalculated afterwards, so a later change to a project or client rate leaves logged work priced
// as it was agreed when it was logged.
async function resolveEntryRate(values: RateInput): Promise<RateContext> {
  const project = await database
    .select({
      id: projects.id,
      hourlyRateCents: projects.hourlyRateCents,
      clientDefaultHourlyRateCents: clients.defaultHourlyRateCents
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projects.id, values.projectId), isNull(projects.deletedAt)))
    .limit(1)
    .then((rows) => rows[0])

  if (!project) throw new ExpectedTimeEntryError(t("timeTracking.errors.projectNotFound"))

  const task = values.taskId
    ? await database.query.tasks.findFirst({
        where: and(eq(tasks.id, values.taskId), isNull(tasks.deletedAt)),
        columns: { id: true, projectId: true, hourlyRateCents: true }
      })
    : null

  if (values.taskId && !task)
    throw new ExpectedTimeEntryError(t("timeTracking.errors.taskNotFound"))

  if (task && task.projectId !== project.id) {
    throw new ExpectedTimeEntryError(t("timeTracking.errors.taskProjectMismatch"))
  }

  const settingsRow = await database.query.settings.findFirst({
    columns: { defaultHourlyRateCents: true }
  })

  return {
    projectId: project.id,
    taskId: task?.id ?? null,
    resolved: resolveHourlyRate({
      entry: { hourlyRateOverrideCents: values.hourlyRate },
      task: task ? { hourlyRateCents: task.hourlyRateCents } : null,
      project: { hourlyRateCents: project.hourlyRateCents },
      client: { defaultHourlyRateCents: project.clientDefaultHourlyRateCents },
      settings: settingsRow ?? null
    })
  }
}

function requireDurationSeconds(startedAt: Date, endedAt: Date): number {
  const durationSeconds = computeDurationSeconds(startedAt, endedAt)

  if (durationSeconds === null) {
    throw new ExpectedTimeEntryError(t("timeTracking.errors.endBeforeStart"))
  }

  return durationSeconds
}

async function loadTimeEntryResult(timeEntryId: string): Promise<TimeEntryMutationResult> {
  const entry = await getTimeEntryForEdit({ id: timeEntryId })

  if (!entry) throw new ExpectedTimeEntryError(t("timeTracking.errors.notFound"))

  return { data: { entry } }
}

async function writeTimeEntryAudit(
  context: TimeEntryWriteContext,
  event: TimeEntryAuditEvent,
  timeEntryId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "time_entry",
    targetEntityId: timeEntryId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function handleTimeEntryError(
  error: unknown,
  action: string,
  userId: string | null,
  timeEntryId?: string
): { error: string } {
  if (error instanceof ExpectedTimeEntryError) return { error: error.message }

  logger.error({ action, userId, timeEntryId, err: error }, "Time entry action failed")

  return { error: t("timeTracking.errors.updateFailed") }
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}

class ExpectedTimeEntryError extends Error {}
