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
import {
  contracts,
  expenses,
  invoices,
  projects,
  proposals,
  recurringInvoices
} from "@/database/schema"

import { getClient } from "@/features/clients/server"

import {
  emitProjectCreated,
  emitProjectDeleted,
  emitProjectStatusChanged,
  emitProjectUpdated
} from "./events"
import { getProjectForEdit } from "./queries"
import {
  createProjectSchema,
  projectIdSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  type CreateProjectValues,
  type UpdateProjectValues
} from "./schemas"
import { canTransitionProjectStatus } from "./services"
import { type ProjectFormData } from "./types"

export type ProjectMutationResult = { data: { project: ProjectFormData } } | { error: string }

export type DeleteProjectResult = { data: { id: string } } | { error: string }

type ProjectWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type ProjectWriteGate = { context: ProjectWriteContext } | { error: string }

type ProjectAuditEvent =
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "project.status_changed"

type ProjectWriteValues = {
  clientId: string
  name: string
  budgetCents: number | null
  hourlyRateCents: number | null
  startDate: Date | null
  endDate: Date | null
  description: string | null
}

const AUDIT_FIELDS = [
  "clientId",
  "name",
  "budgetCents",
  "hourlyRateCents",
  "startDate",
  "endDate",
  "description"
] as const

const projectsPath = "/projects"

export async function createProject(input: unknown): Promise<ProjectMutationResult> {
  const gate = await requireProjectWrite()

  if ("error" in gate) return gate

  const parsed = createProjectSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const client = await getClient({ id: parsed.data.clientId })

    if (!client) throw new ExpectedProjectError(t("projects.errors.clientNotFound"))

    const writeValues = toProjectWriteValues(parsed.data)

    const [createdProject] = await database
      .insert(projects)
      // Currency is taken from the client rather than the submitted form: a project's money must
      // be denominated in the currency its client is billed in, so it is never user-editable here.
      .values({ ...writeValues, currency: client.currency, status: parsed.data.status })
      .returning({ id: projects.id })

    if (!createdProject) throw new Error("Project insert returned no row")

    await writeProjectAudit(context, "project.created", createdProject.id, {
      changedFields: getPopulatedProjectFields(writeValues),
      status: parsed.data.status
    })
    await emitProjectCreated({ projectId: createdProject.id, userId: context.userId })

    revalidatePath(projectsPath)
    revalidatePath(`/clients/${client.id}`)

    return await loadProjectResult(createdProject.id)
  } catch (error) {
    return handleProjectActionError(error, "createProject", context.userId)
  }
}

export async function updateProject(input: unknown): Promise<ProjectMutationResult> {
  const gate = await requireProjectWrite()

  if ("error" in gate) return gate

  const parsed = updateProjectSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existingProject = await database.query.projects.findFirst({
      where: and(eq(projects.id, parsed.data.id), isNull(projects.deletedAt))
    })

    if (!existingProject) throw new ExpectedProjectError(t("projects.errors.notFound"))

    const client = await getClient({ id: parsed.data.clientId })

    if (!client) throw new ExpectedProjectError(t("projects.errors.clientNotFound"))

    if (existingProject.clientId !== client.id && (await hasFinancialRecords(existingProject.id))) {
      throw new ExpectedProjectError(t("projects.errors.clientChangeBlocked"))
    }

    const writeValues = toProjectWriteValues(parsed.data)

    const [updatedProject] = await database
      .update(projects)
      .set({ ...writeValues, currency: client.currency })
      .where(and(eq(projects.id, parsed.data.id), isNull(projects.deletedAt)))
      .returning({ id: projects.id })

    if (!updatedProject) throw new ExpectedProjectError(t("projects.errors.notFound"))

    const changedFields = getChangedProjectFields(existingProject, writeValues)

    await writeProjectAudit(context, "project.updated", updatedProject.id, { changedFields })
    await emitProjectUpdated({
      projectId: updatedProject.id,
      userId: context.userId,
      changedFields
    })

    revalidatePath(projectsPath)
    revalidatePath(`${projectsPath}/${updatedProject.id}`)
    revalidatePath(`/clients/${client.id}`)

    return await loadProjectResult(updatedProject.id)
  } catch (error) {
    return handleProjectActionError(error, "updateProject", context.userId, parsed.data.id)
  }
}

export async function updateProjectStatus(input: unknown): Promise<ProjectMutationResult> {
  const gate = await requireProjectWrite()

  if ("error" in gate) return gate

  const parsed = updateProjectStatusSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existingProject = await database.query.projects.findFirst({
      where: and(eq(projects.id, parsed.data.id), isNull(projects.deletedAt))
    })

    if (!existingProject) throw new ExpectedProjectError(t("projects.errors.notFound"))

    const transition = canTransitionProjectStatus(existingProject.status, parsed.data.status)

    if (!transition.allowed) throw new ExpectedProjectError(t("projects.errors.invalidTransition"))

    const [updatedProject] = await database
      .update(projects)
      .set({ status: transition.nextStatus })
      .where(and(eq(projects.id, parsed.data.id), isNull(projects.deletedAt)))
      .returning({ id: projects.id, status: projects.status })

    if (!updatedProject) throw new ExpectedProjectError(t("projects.errors.notFound"))

    await writeProjectAudit(context, "project.status_changed", updatedProject.id, {
      from: existingProject.status,
      to: updatedProject.status
    })
    await emitProjectStatusChanged({
      projectId: updatedProject.id,
      userId: context.userId,
      from: existingProject.status,
      to: updatedProject.status
    })

    revalidatePath(projectsPath)
    revalidatePath(`${projectsPath}/${updatedProject.id}`)

    return await loadProjectResult(updatedProject.id)
  } catch (error) {
    return handleProjectActionError(error, "updateProjectStatus", context.userId, parsed.data.id)
  }
}

export async function softDeleteProject(input: unknown): Promise<DeleteProjectResult> {
  const gate = await requireProjectDelete()

  if ("error" in gate) return gate

  const parsed = projectIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deletedProject] = await database
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(and(eq(projects.id, parsed.data.id), isNull(projects.deletedAt)))
      .returning({ id: projects.id, clientId: projects.clientId })

    if (!deletedProject) throw new ExpectedProjectError(t("projects.errors.notFound"))

    await writeProjectAudit(context, "project.deleted", deletedProject.id, { softDeleted: true })
    await emitProjectDeleted({ projectId: deletedProject.id, userId: context.userId })

    revalidatePath(projectsPath)
    revalidatePath(`${projectsPath}/${deletedProject.id}`)
    revalidatePath(`/clients/${deletedProject.clientId}`)

    return { data: { id: deletedProject.id } }
  } catch (error) {
    return handleProjectActionError(error, "softDeleteProject", context.userId, parsed.data.id)
  }
}

// The user-facing half of the re-parent rule. `fk_<table>_project_client`'s `ON UPDATE RESTRICT`
// already refuses the write, but a raw foreign-key error is not something a user may ever see
// (`errors.md`), and the database cannot say which records are in the way. Soft-deleted rows count:
// they still hold the old `client_id` and would be restored pointing at the wrong client.
async function hasFinancialRecords(projectId: string): Promise<boolean> {
  const [invoiceRow, expenseRow, contractRow, scheduleRow, proposalRow] = await Promise.all([
    database.query.invoices.findFirst({
      columns: { id: true },
      where: eq(invoices.projectId, projectId)
    }),
    database.query.expenses.findFirst({
      columns: { id: true },
      where: eq(expenses.projectId, projectId)
    }),
    database.query.contracts.findFirst({
      columns: { id: true },
      where: eq(contracts.projectId, projectId)
    }),
    database.query.recurringInvoices.findFirst({
      columns: { id: true },
      where: eq(recurringInvoices.projectId, projectId)
    }),
    database.query.proposals.findFirst({
      columns: { id: true },
      where: eq(proposals.projectId, projectId)
    })
  ])

  return Boolean(invoiceRow ?? expenseRow ?? contractRow ?? scheduleRow ?? proposalRow)
}

async function loadProjectResult(projectId: string): Promise<ProjectMutationResult> {
  const project = await getProjectForEdit({ id: projectId })

  if (!project) throw new ExpectedProjectError(t("projects.errors.notFound"))

  return { data: { project } }
}

async function requireProjectWrite(): Promise<ProjectWriteGate> {
  const gate = await getProjectActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner" && gate.context.role !== "assistant") {
    return { error: t("errors.forbidden") }
  }

  return gate
}

async function requireProjectDelete(): Promise<ProjectWriteGate> {
  const gate = await getProjectActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner") return { error: t("errors.forbidden") }

  return gate
}

async function getProjectActionContext(): Promise<ProjectWriteGate> {
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

async function writeProjectAudit(
  context: ProjectWriteContext,
  event: ProjectAuditEvent,
  projectId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "project",
    targetEntityId: projectId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function toProjectWriteValues(
  values: CreateProjectValues | UpdateProjectValues
): ProjectWriteValues {
  return {
    clientId: values.clientId,
    name: values.name,
    budgetCents: values.budget,
    hourlyRateCents: values.hourlyRate,
    startDate: values.startDate,
    endDate: values.endDate,
    description: emptyToNull(values.description)
  }
}

function getPopulatedProjectFields(values: ProjectWriteValues): string[] {
  return AUDIT_FIELDS.filter((field) => {
    const value = values[field]

    return value !== null && value !== ""
  })
}

function getChangedProjectFields(
  existing: typeof projects.$inferSelect,
  next: ProjectWriteValues
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

function handleProjectActionError(
  error: unknown,
  action: string,
  userId: string | null,
  projectId?: string
): { error: string } {
  if (error instanceof ExpectedProjectError) return { error: error.message }

  logger.error({ action, userId, projectId, err: error }, "Project action failed")

  return { error: t("projects.errors.updateFailed") }
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}

class ExpectedProjectError extends Error {}
