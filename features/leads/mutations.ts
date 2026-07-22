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
import { leads } from "@/database/schema"

import { createClient } from "@/features/clients/server"

import {
  emitLeadConverted,
  emitLeadCreated,
  emitLeadDeleted,
  emitLeadStageChanged,
  emitLeadUpdated
} from "./events"
import { toLeadFormData } from "./queries"
import {
  convertLeadSchema,
  createLeadSchema,
  leadIdSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  type CreateLeadValues,
  type UpdateLeadValues
} from "./schemas"
import { canTransitionLeadStatus } from "./services"
import { type LeadFormData } from "./types"

export type LeadMutationResult = { data: { lead: LeadFormData } } | { error: string }

export type DeleteLeadResult = { data: { id: string } } | { error: string }

export type ConvertLeadResult = { data: { clientId: string } } | { error: string }

type LeadWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type LeadWriteGate = { context: LeadWriteContext } | { error: string }

type LeadAuditEvent =
  | "lead.created"
  | "lead.updated"
  | "lead.deleted"
  | "lead.stage_changed"
  | "lead.converted"

type LeadAuditField = "firstName" | "lastName" | "company" | "email" | "phone" | "source"

const leadsPath = "/leads"

const auditFields = [
  "firstName",
  "lastName",
  "company",
  "email",
  "phone",
  "source"
] as const satisfies readonly LeadAuditField[]

export async function createLead(input: unknown): Promise<LeadMutationResult> {
  const gate = await requireLeadWrite()

  if ("error" in gate) return gate

  const parsed = createLeadSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [createdLead] = await database
      .insert(leads)
      .values({ ...toLeadProfileValues(parsed.data), status: parsed.data.status })
      .returning()

    if (!createdLead) throw new Error("Lead insert returned no row")

    const changedFields = getCreatedAuditFields(parsed.data)

    await writeLeadAudit(context, "lead.created", createdLead.id, {
      changedFields,
      status: createdLead.status
    })
    await emitLeadCreated({ leadId: createdLead.id, userId: context.userId })

    revalidatePath(leadsPath)

    return { data: { lead: toLeadFormData(createdLead) } }
  } catch (error) {
    return handleLeadActionError(error, "createLead", context.userId)
  }
}

export async function updateLead(input: unknown): Promise<LeadMutationResult> {
  const gate = await requireLeadWrite()

  if ("error" in gate) return gate

  const parsed = updateLeadSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existingLead = await database.query.leads.findFirst({
      where: and(eq(leads.id, parsed.data.id), isNull(leads.deletedAt))
    })

    if (!existingLead) throw new ExpectedLeadError(t("leads.errors.notFound"))

    const [updatedLead] = await database
      .update(leads)
      .set(toLeadProfileValues(parsed.data))
      .where(and(eq(leads.id, parsed.data.id), isNull(leads.deletedAt)))
      .returning()

    if (!updatedLead) throw new ExpectedLeadError(t("leads.errors.notFound"))

    const changedFields = getUpdatedAuditFields(existingLead, parsed.data)

    await writeLeadAudit(context, "lead.updated", updatedLead.id, { changedFields })
    await emitLeadUpdated({ leadId: updatedLead.id, userId: context.userId, changedFields })

    revalidatePath(leadsPath)
    revalidatePath(`${leadsPath}/${updatedLead.id}`)

    return { data: { lead: toLeadFormData(updatedLead) } }
  } catch (error) {
    return handleLeadActionError(error, "updateLead", context.userId, parsed.data.id)
  }
}

export async function updateLeadStatus(input: unknown): Promise<LeadMutationResult> {
  const gate = await requireLeadWrite()

  if ("error" in gate) return gate

  const parsed = updateLeadStatusSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existingLead = await database.query.leads.findFirst({
      where: and(eq(leads.id, parsed.data.id), isNull(leads.deletedAt))
    })

    if (!existingLead) throw new ExpectedLeadError(t("leads.errors.notFound"))

    const transition = canTransitionLeadStatus(existingLead.status, parsed.data.status)

    if (!transition.allowed) throw new ExpectedLeadError(t("leads.errors.invalidTransition"))

    const lostReason = parsed.data.status === "lost" ? parsed.data.lostReason : null

    const [updatedLead] = await database
      .update(leads)
      .set({ status: transition.nextStatus, lostReason })
      .where(and(eq(leads.id, parsed.data.id), isNull(leads.deletedAt)))
      .returning()

    if (!updatedLead) throw new ExpectedLeadError(t("leads.errors.notFound"))

    await writeLeadAudit(context, "lead.stage_changed", updatedLead.id, {
      from: existingLead.status,
      to: updatedLead.status
    })
    await emitLeadStageChanged({
      leadId: updatedLead.id,
      userId: context.userId,
      from: existingLead.status,
      to: updatedLead.status
    })

    revalidatePath(leadsPath)
    revalidatePath(`${leadsPath}/${updatedLead.id}`)

    return { data: { lead: toLeadFormData(updatedLead) } }
  } catch (error) {
    return handleLeadActionError(error, "updateLeadStatus", context.userId, parsed.data.id)
  }
}

export async function convertLeadToClient(input: unknown): Promise<ConvertLeadResult> {
  const gate = await requireLeadWrite()

  if ("error" in gate) return gate

  const parsed = convertLeadSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existingLead = await database.query.leads.findFirst({
      where: and(eq(leads.id, parsed.data.id), isNull(leads.deletedAt))
    })

    if (!existingLead) throw new ExpectedLeadError(t("leads.errors.notFound"))

    if (existingLead.convertedToClientId) {
      throw new ExpectedLeadError(t("leads.errors.alreadyConverted"))
    }

    const clientResult = await createClient({
      name: parsed.data.name,
      email: existingLead.email,
      phone: existingLead.phone ?? "",
      currency: parsed.data.currency,
      taxId: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      notes: "",
      website: ""
    })

    if ("error" in clientResult) return { error: clientResult.error }

    const clientId = clientResult.data.client.id

    const [convertedLead] = await database
      .update(leads)
      .set({ convertedAt: new Date(), convertedToClientId: clientId })
      .where(and(eq(leads.id, parsed.data.id), isNull(leads.deletedAt)))
      .returning({ id: leads.id })

    if (!convertedLead) throw new ExpectedLeadError(t("leads.errors.notFound"))

    await writeLeadAudit(context, "lead.converted", convertedLead.id, { clientId })
    await emitLeadConverted({ leadId: convertedLead.id, userId: context.userId, clientId })

    revalidatePath(leadsPath)
    revalidatePath(`${leadsPath}/${convertedLead.id}`)
    revalidatePath("/clients")

    return { data: { clientId } }
  } catch (error) {
    return handleLeadActionError(error, "convertLeadToClient", context.userId, parsed.data.id)
  }
}

export async function softDeleteLead(input: unknown): Promise<DeleteLeadResult> {
  const gate = await requireLeadDelete()

  if ("error" in gate) return gate

  const parsed = leadIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deletedLead] = await database
      .update(leads)
      .set({ deletedAt: new Date() })
      .where(and(eq(leads.id, parsed.data.id), isNull(leads.deletedAt)))
      .returning({ id: leads.id })

    if (!deletedLead) throw new ExpectedLeadError(t("leads.errors.notFound"))

    await writeLeadAudit(context, "lead.deleted", deletedLead.id, { softDeleted: true })
    await emitLeadDeleted({ leadId: deletedLead.id, userId: context.userId })

    revalidatePath(leadsPath)
    revalidatePath(`${leadsPath}/${deletedLead.id}`)

    return { data: { id: deletedLead.id } }
  } catch (error) {
    return handleLeadActionError(error, "softDeleteLead", context.userId, parsed.data.id)
  }
}

async function requireLeadWrite(): Promise<LeadWriteGate> {
  const gate = await getLeadActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner" && gate.context.role !== "assistant") {
    return { error: t("errors.forbidden") }
  }

  return gate
}

async function requireLeadDelete(): Promise<LeadWriteGate> {
  const gate = await getLeadActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner") return { error: t("errors.forbidden") }

  return gate
}

async function getLeadActionContext(): Promise<LeadWriteGate> {
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

async function writeLeadAudit(
  context: LeadWriteContext,
  event: LeadAuditEvent,
  leadId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "lead",
    targetEntityId: leadId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function toLeadProfileValues(
  values: CreateLeadValues | UpdateLeadValues
): typeof leads.$inferInsert {
  return {
    firstName: emptyToNull(values.firstName),
    lastName: emptyToNull(values.lastName),
    company: emptyToNull(values.company),
    email: values.email,
    phone: emptyToNull(values.phone),
    source: emptyToNull(values.source),
    notes: emptyToNull(values.notes),
    lostReason: emptyToNull(values.lostReason)
  }
}

function getCreatedAuditFields(values: CreateLeadValues): LeadAuditField[] {
  return auditFields.filter((field) => values[field].trim().length > 0)
}

function getUpdatedAuditFields(
  existingLead: typeof leads.$inferSelect,
  values: UpdateLeadValues
): LeadAuditField[] {
  return auditFields.filter((field) => (existingLead[field] ?? "") !== values[field].trim())
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function handleLeadActionError(
  error: unknown,
  action: string,
  userId: string | null,
  leadId?: string
): { error: string } {
  if (error instanceof ExpectedLeadError) return { error: error.message }

  logger.error({ action, userId, leadId, err: error }, "Lead action failed")

  return { error: t("leads.errors.updateFailed") }
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}

class ExpectedLeadError extends Error {}
