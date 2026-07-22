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
import { clients } from "@/database/schema"

import { emitClientCreated, emitClientDeleted, emitClientUpdated } from "./events"
import { toClientFormData } from "./queries"
import {
  clientIdSchema,
  createClientSchema,
  updateClientSchema,
  type ClientFormValues
} from "./schemas"
import { type ClientFormData } from "./types"

export type ClientMutationResult = { data: { client: ClientFormData } } | { error: string }

export type DeleteClientResult = { data: { id: string } } | { error: string }

type ClientWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type ClientWriteGate = { context: ClientWriteContext } | { error: string }

type ClientAuditEvent = "client.created" | "client.updated" | "client.deleted"

type ClientAuditField =
  | "name"
  | "email"
  | "phone"
  | "currency"
  | "taxId"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "state"
  | "postalCode"
  | "country"
  | "website"

const clientsPath = "/clients"

const clientReturnColumns = {
  id: clients.id,
  name: clients.name,
  email: clients.email,
  phone: clients.phone,
  website: clients.website,
  taxId: clients.taxId,
  addressLine1: clients.addressLine1,
  addressLine2: clients.addressLine2,
  city: clients.city,
  state: clients.state,
  postalCode: clients.postalCode,
  country: clients.country,
  currency: clients.currency,
  locale: clients.locale,
  notes: clients.notes,
  portalToken: clients.portalToken,
  deletedAt: clients.deletedAt,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt
} as const

const auditFields = [
  "name",
  "email",
  "phone",
  "currency",
  "taxId",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "postalCode",
  "country",
  "website"
] as const satisfies readonly ClientAuditField[]

export async function createClient(input: unknown): Promise<ClientMutationResult> {
  const gate = await requireClientWrite()

  if ("error" in gate) return gate

  const parsed = createClientSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [createdClient] = await database
      .insert(clients)
      .values(toClientWriteValues(parsed.data))
      .returning(clientReturnColumns)

    if (!createdClient) throw new Error("Client insert returned no row")

    const changedFields = getCreatedAuditFields(parsed.data)

    await writeClientAudit(context, "client.created", createdClient.id, { changedFields })
    await emitClientCreated({ clientId: createdClient.id, userId: context.userId })

    revalidatePath(clientsPath)

    return { data: { client: toClientFormData(createdClient) } }
  } catch (error) {
    return handleClientActionError(error, "createClient", context.userId)
  }
}

export async function updateClient(input: unknown): Promise<ClientMutationResult> {
  const gate = await requireClientWrite()

  if ("error" in gate) return gate

  const parsed = updateClientSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existingClient = await database.query.clients.findFirst({
      where: and(eq(clients.id, parsed.data.id), isNull(clients.deletedAt))
    })

    if (!existingClient) throw new ExpectedClientError(t("clients.errors.notFound"))

    const [updatedClient] = await database
      .update(clients)
      .set(toClientWriteValues(parsed.data))
      .where(and(eq(clients.id, parsed.data.id), isNull(clients.deletedAt)))
      .returning(clientReturnColumns)

    if (!updatedClient) throw new ExpectedClientError(t("clients.errors.notFound"))

    const changedFields = getUpdatedAuditFields(existingClient, parsed.data)

    await writeClientAudit(context, "client.updated", updatedClient.id, { changedFields })
    await emitClientUpdated({
      clientId: updatedClient.id,
      userId: context.userId,
      changedFields
    })

    revalidatePath(clientsPath)
    revalidatePath(`${clientsPath}/${updatedClient.id}`)

    return { data: { client: toClientFormData(updatedClient) } }
  } catch (error) {
    return handleClientActionError(error, "updateClient", context.userId, parsed.data.id)
  }
}

export async function softDeleteClient(input: unknown): Promise<DeleteClientResult> {
  const gate = await requireClientDelete()

  if ("error" in gate) return gate

  const parsed = clientIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deletedClient] = await database
      .update(clients)
      .set({ deletedAt: new Date() })
      .where(and(eq(clients.id, parsed.data.id), isNull(clients.deletedAt)))
      .returning({ id: clients.id })

    if (!deletedClient) throw new ExpectedClientError(t("clients.errors.notFound"))

    await writeClientAudit(context, "client.deleted", deletedClient.id, { softDeleted: true })
    await emitClientDeleted({ clientId: deletedClient.id, userId: context.userId })

    revalidatePath(clientsPath)
    revalidatePath(`${clientsPath}/${deletedClient.id}`)

    return { data: { id: deletedClient.id } }
  } catch (error) {
    return handleClientActionError(error, "softDeleteClient", context.userId, parsed.data.id)
  }
}

async function requireClientWrite(): Promise<ClientWriteGate> {
  const gate = await getClientActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner" && gate.context.role !== "assistant") {
    return { error: t("errors.forbidden") }
  }

  return gate
}

async function requireClientDelete(): Promise<ClientWriteGate> {
  const gate = await getClientActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner") return { error: t("errors.forbidden") }

  return gate
}

async function getClientActionContext(): Promise<ClientWriteGate> {
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

async function writeClientAudit(
  context: ClientWriteContext,
  event: ClientAuditEvent,
  clientId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "client",
    targetEntityId: clientId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function toClientWriteValues(values: ClientFormValues): typeof clients.$inferInsert {
  return {
    name: values.name,
    email: values.email,
    phone: emptyToNull(values.phone),
    currency: values.currency,
    taxId: emptyToNull(values.taxId),
    addressLine1: emptyToNull(values.addressLine1),
    addressLine2: emptyToNull(values.addressLine2),
    city: emptyToNull(values.city),
    state: emptyToNull(values.state),
    postalCode: emptyToNull(values.postalCode),
    country: emptyToNull(values.country),
    notes: emptyToNull(values.notes),
    website: emptyToNull(values.website)
  }
}

function getCreatedAuditFields(values: ClientFormValues): ClientAuditField[] {
  return auditFields.filter((field) => getClientValue(values, field).length > 0)
}

function getUpdatedAuditFields(
  existingClient: typeof clients.$inferSelect,
  values: ClientFormValues
): ClientAuditField[] {
  return auditFields.filter(
    (field) => getExistingClientValue(existingClient, field) !== getClientValue(values, field)
  )
}

function getClientValue(values: ClientFormValues, field: ClientAuditField): string {
  return values[field].trim()
}

function getExistingClientValue(
  existingClient: typeof clients.$inferSelect,
  field: ClientAuditField
): string {
  return existingClient[field] ?? ""
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function handleClientActionError(
  error: unknown,
  action: string,
  userId: string | null,
  clientId?: string
): { error: string } {
  if (error instanceof ExpectedClientError) return { error: error.message }

  logger.error({ action, userId, clientId, err: error }, "Client action failed")

  return { error: t("clients.errors.updateFailed") }
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}

class ExpectedClientError extends Error {}
