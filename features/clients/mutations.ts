"use server"

import { revalidatePath } from "next/cache"

import { and, eq, isNull, ne } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { parseAmountToCents } from "@/lib/utils"

import { mintPublicToken } from "@/lib/publicToken"

import { database } from "@/database"
import { clientContacts, clients } from "@/database/schema"

import { emitClientCreated, emitClientDeleted, emitClientUpdated } from "./events"
import {
  ExpectedClientError,
  handleClientActionError,
  requireClientDelete,
  requireClientPortalLink,
  requireClientWrite,
  writeClientAudit,
  type ClientContactAuditEvent,
  type ClientWriteContext
} from "./mutationContext"
import { toClientFormData } from "./queries"
import {
  clientContactIdSchema,
  clientIdSchema,
  createClientContactSchema,
  createClientSchema,
  updateClientContactSchema,
  updateClientSchema,
  type ClientContactFormValues,
  type ClientFormValues
} from "./schemas"
import { type ClientFormData } from "./types"

export type ClientMutationResult = { data: { client: ClientFormData } } | { error: string }

export type DeleteClientResult = { data: { id: string } } | { error: string }

export type ClientContactMutationResult = { data: { id: string } } | { error: string }

export type ClientPortalLinkResult = { data: { id: string } } | { error: string }

type ClientContactTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0]

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
  defaultHourlyRateCents: clients.defaultHourlyRateCents,
  notes: clients.notes,
  imageUploadId: clients.imageUploadId,
  portalToken: clients.portalToken,
  deletedAt: clients.deletedAt,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt
} as const

// Every writable *string* client field except `notes`, which is excluded because it is the one
// encrypted column on the table (see `security.md`): no encrypted field takes part in audit
// diffing, so this list must not be "completed" from the client schema. `defaultHourlyRateCents` is
// absent for the other reason — the two helpers below diff trimmed strings, and it is the one
// numeric column here.
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
    // Clearing `portalToken` is part of the delete, not a separate decision: the portal is a standing
    // bearer door into everything Remit holds about this client, and leaving it open on a record the
    // owner believes is gone is the failure this stage exists to prevent (ADR-0029). A restore
    // therefore comes back without a portal, and re-enabling one is an explicit act.
    const [deletedClient] = await database
      .update(clients)
      .set({ deletedAt: new Date(), portalToken: null })
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

export async function rotateClientPortalLink(input: unknown): Promise<ClientPortalLinkResult> {
  const gate = await requireClientPortalLink()

  if ("error" in gate) return gate

  const parsed = clientIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await loadLiveClientForPortalLink(parsed.data.id)

    const [rotated] = await database
      .update(clients)
      .set({ portalToken: mintPublicToken() })
      .where(and(eq(clients.id, existing.id), isNull(clients.deletedAt)))
      .returning({ id: clients.id })

    if (!rotated) throw new ExpectedClientError(t("clients.errors.notFound"))

    // Records that the portal link changed and whether one was live before it, never either token:
    // the audit trail is readable by anyone with database access, and both values are bearer
    // credentials (`security.md`).
    await writeClientAudit(context, "client.portal_link.rotated", rotated.id, {
      previousState: existing.portalToken ? "live" : "none"
    })

    revalidatePath(clientsPath)
    revalidatePath(`${clientsPath}/${rotated.id}`)

    return { data: { id: rotated.id } }
  } catch (error) {
    return handleClientActionError(error, "rotateClientPortalLink", context.userId, parsed.data.id)
  }
}

export async function revokeClientPortalLink(input: unknown): Promise<ClientPortalLinkResult> {
  const gate = await requireClientPortalLink()

  if ("error" in gate) return gate

  const parsed = clientIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await loadLiveClientForPortalLink(parsed.data.id)

    if (!existing.portalToken) {
      throw new ExpectedClientError(t("clients.errors.portalLinkAlreadyRevoked"))
    }

    const [revoked] = await database
      .update(clients)
      .set({ portalToken: null })
      .where(and(eq(clients.id, existing.id), isNull(clients.deletedAt)))
      .returning({ id: clients.id })

    if (!revoked) throw new ExpectedClientError(t("clients.errors.notFound"))

    await writeClientAudit(context, "client.portal_link.revoked", revoked.id, {})

    revalidatePath(clientsPath)
    revalidatePath(`${clientsPath}/${revoked.id}`)

    return { data: { id: revoked.id } }
  } catch (error) {
    return handleClientActionError(error, "revokeClientPortalLink", context.userId, parsed.data.id)
  }
}

export async function createClientContact(input: unknown): Promise<ClientContactMutationResult> {
  const gate = await requireClientWrite()

  if ("error" in gate) return gate

  const parsed = createClientContactSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { clientId, isPrimary, ...values } = parsed.data

  try {
    const contactId = await database.transaction(async (transaction) => {
      const [client] = await transaction
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
        .limit(1)

      if (!client) throw new ExpectedClientError(t("clients.errors.notFound"))

      // The first contact takes the primary slot even when the form left the box unticked: a client
      // with contacts but no primary keeps sending every document to `clients.email`, which reads
      // as the list doing nothing.
      const primary = isPrimary || !(await hasPrimaryContact(transaction, clientId))

      if (primary) await demotePrimaryContacts(transaction, clientId, null)

      const [created] = await transaction
        .insert(clientContacts)
        .values({ clientId, ...toContactWriteValues(values), isPrimary: primary })
        .returning({ id: clientContacts.id })

      if (!created) throw new Error("Client contact insert returned no row")

      return created.id
    })

    await writeClientContactAudit(context, "client_contact.created", contactId, { clientId })

    revalidatePath(`${clientsPath}/${clientId}`)

    return { data: { id: contactId } }
  } catch (error) {
    return handleClientContactActionError(error, "createClientContact", context.userId, clientId)
  }
}

export async function updateClientContact(input: unknown): Promise<ClientContactMutationResult> {
  const gate = await requireClientWrite()

  if ("error" in gate) return gate

  const parsed = updateClientContactSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { id, isPrimary, ...values } = parsed.data

  try {
    const clientId = await database.transaction(async (transaction) => {
      const existingClientId = await findContactClientId(transaction, id)

      if (isPrimary) await demotePrimaryContacts(transaction, existingClientId, id)

      const [updated] = await transaction
        .update(clientContacts)
        .set({ ...toContactWriteValues(values), isPrimary })
        .where(and(eq(clientContacts.id, id), isNull(clientContacts.deletedAt)))
        .returning({ id: clientContacts.id })

      if (!updated) throw new ExpectedClientError(t("clients.errors.contactNotFound"))

      return existingClientId
    })

    await writeClientContactAudit(context, "client_contact.updated", id, { clientId, isPrimary })

    revalidatePath(`${clientsPath}/${clientId}`)

    return { data: { id } }
  } catch (error) {
    return handleClientContactActionError(error, "updateClientContact", context.userId)
  }
}

export async function setPrimaryClientContact(
  input: unknown
): Promise<ClientContactMutationResult> {
  const gate = await requireClientWrite()

  if ("error" in gate) return gate

  const parsed = clientContactIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { id } = parsed.data

  try {
    const clientId = await database.transaction(async (transaction) => {
      const existingClientId = await findContactClientId(transaction, id)

      await demotePrimaryContacts(transaction, existingClientId, id)

      const [promoted] = await transaction
        .update(clientContacts)
        .set({ isPrimary: true })
        .where(and(eq(clientContacts.id, id), isNull(clientContacts.deletedAt)))
        .returning({ id: clientContacts.id })

      if (!promoted) throw new ExpectedClientError(t("clients.errors.contactNotFound"))

      return existingClientId
    })

    await writeClientContactAudit(context, "client_contact.primary_changed", id, { clientId })

    revalidatePath(`${clientsPath}/${clientId}`)

    return { data: { id } }
  } catch (error) {
    return handleClientContactActionError(error, "setPrimaryClientContact", context.userId)
  }
}

export async function softDeleteClientContact(
  input: unknown
): Promise<ClientContactMutationResult> {
  const gate = await requireClientDelete()

  if ("error" in gate) return gate

  const parsed = clientContactIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    // Deleting the primary frees the slot rather than handing it to another contact:
    // `uq_client_contacts_primary` ignores soft-deleted rows, and the client falls back to
    // `clients.email` until someone chooses the replacement. Promoting a survivor automatically
    // would silently redirect every future document to an address nobody picked.
    const [deleted] = await database
      .update(clientContacts)
      .set({ deletedAt: new Date() })
      .where(and(eq(clientContacts.id, parsed.data.id), isNull(clientContacts.deletedAt)))
      .returning({ id: clientContacts.id, clientId: clientContacts.clientId })

    if (!deleted) throw new ExpectedClientError(t("clients.errors.contactNotFound"))

    await writeClientContactAudit(context, "client_contact.deleted", deleted.id, {
      clientId: deleted.clientId,
      softDeleted: true
    })

    revalidatePath(`${clientsPath}/${deleted.clientId}`)

    return { data: { id: deleted.id } }
  } catch (error) {
    return handleClientContactActionError(error, "softDeleteClientContact", context.userId)
  }
}

// A soft-deleted client has no portal to manage: `softDeleteClient` clears the token as part of the
// delete, and a client outside the workspace must not be handed a live door back into it.
async function loadLiveClientForPortalLink(clientId: string) {
  const client = await database.query.clients.findFirst({
    where: and(eq(clients.id, clientId), isNull(clients.deletedAt)),
    columns: { id: true, portalToken: true }
  })

  if (!client) throw new ExpectedClientError(t("clients.errors.notFound"))

  return client
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
    website: emptyToNull(values.website),
    defaultHourlyRateCents: parseAmountToCents(values.defaultHourlyRate)
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

async function findContactClientId(
  transaction: ClientContactTransaction,
  contactId: string
): Promise<string> {
  const [existing] = await transaction
    .select({ clientId: clientContacts.clientId })
    .from(clientContacts)
    .where(and(eq(clientContacts.id, contactId), isNull(clientContacts.deletedAt)))
    .limit(1)

  if (!existing) throw new ExpectedClientError(t("clients.errors.contactNotFound"))

  return existing.clientId
}

async function hasPrimaryContact(
  transaction: ClientContactTransaction,
  clientId: string
): Promise<boolean> {
  const [primary] = await transaction
    .select({ id: clientContacts.id })
    .from(clientContacts)
    .where(
      and(
        eq(clientContacts.clientId, clientId),
        eq(clientContacts.isPrimary, true),
        isNull(clientContacts.deletedAt)
      )
    )
    .limit(1)

  return primary !== undefined
}

// Demote-then-promote inside one transaction, because `uq_client_contacts_primary` refuses two live
// primaries and a bare promotion would hit it every time. Two concurrent promotions still collide —
// the second demote waits on the first transaction's row locks and then re-reads a slot that is
// already taken — and the loser surfaces as a 23505 in handleClientContactActionError.
async function demotePrimaryContacts(
  transaction: ClientContactTransaction,
  clientId: string,
  exceptContactId: string | null
): Promise<void> {
  const scope = [
    eq(clientContacts.clientId, clientId),
    eq(clientContacts.isPrimary, true),
    isNull(clientContacts.deletedAt)
  ]

  await transaction
    .update(clientContacts)
    .set({ isPrimary: false })
    .where(and(...scope, ...(exceptContactId ? [ne(clientContacts.id, exceptContactId)] : [])))
}

async function writeClientContactAudit(
  context: ClientWriteContext,
  event: ClientContactAuditEvent,
  contactId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "client_contact",
    targetEntityId: contactId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function toContactWriteValues(
  values: Omit<ClientContactFormValues, "isPrimary">
): Pick<typeof clientContacts.$inferInsert, "name" | "email" | "phone" | "role"> {
  return {
    name: values.name,
    email: values.email,
    phone: emptyToNull(values.phone),
    role: emptyToNull(values.role)
  }
}

function handleClientContactActionError(
  error: unknown,
  action: string,
  userId: string | null,
  clientId?: string
): { error: string } {
  if (error instanceof ExpectedClientError) return { error: error.message }

  // The one raw driver error this feature can actually produce. `uq_client_contacts_primary` is
  // what serializes concurrent promotions, so the loser arrives here as a unique violation and has
  // to leave as a sentence the freelancer can act on.
  if (isPrimaryContactConflict(error)) return { error: t("clients.errors.contactPrimaryConflict") }

  logger.error({ action, userId, clientId, err: error }, "Client contact action failed")

  return { error: t("clients.errors.contactUpdateFailed") }
}

function isPrimaryContactConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  )
}
