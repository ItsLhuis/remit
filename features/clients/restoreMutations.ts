"use server"

import { revalidatePath } from "next/cache"

import { and, eq, isNotNull, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { clientContacts, clients } from "@/database/schema"

import { resolveRestoreBlocker } from "@/features/trash"

import {
  ExpectedClientError,
  handleClientActionError,
  handleClientContactActionError,
  requireClientDelete,
  writeClientAudit,
  writeClientContactAudit
} from "./mutationContext"
import { type ClientContactMutationResult, type DeleteClientResult } from "./mutations"
import { clientContactIdSchema, clientIdSchema } from "./schemas"

const clientsPath = "/clients"

export async function restoreClient(input: unknown): Promise<DeleteClientResult> {
  const gate = await requireClientDelete()

  if ("error" in gate) return gate

  const parsed = clientIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    // The portal token stays null. `softDeleteClient` revoked it deliberately, and a restore that
    // silently re-opened a standing bearer door into everything Remit holds about this client would
    // undo that decision without anybody asking for it (ADR-0029).
    const [restored] = await database
      .update(clients)
      .set({ deletedAt: null })
      .where(and(eq(clients.id, parsed.data.id), isNotNull(clients.deletedAt)))
      .returning({ id: clients.id })

    if (!restored) throw new ExpectedClientError(t("clients.errors.notFound"))

    await writeClientAudit(context, "client.restored", restored.id, {})

    revalidatePath(clientsPath)
    revalidatePath(`${clientsPath}/${restored.id}`)

    return { data: { id: restored.id } }
  } catch (error) {
    return handleClientActionError(error, "restoreClient", context.userId, parsed.data.id)
  }
}

export async function restoreClientContact(input: unknown): Promise<ClientContactMutationResult> {
  const gate = await requireClientDelete()

  if ("error" in gate) return gate

  const parsed = clientContactIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [existing] = await database
      .select({
        id: clientContacts.id,
        clientId: clientContacts.clientId,
        isPrimary: clientContacts.isPrimary,
        clientDeletedAt: clients.deletedAt
      })
      .from(clientContacts)
      .leftJoin(clients, eq(clients.id, clientContacts.clientId))
      .where(and(eq(clientContacts.id, parsed.data.id), isNotNull(clientContacts.deletedAt)))

    if (!existing) throw new ExpectedClientError(t("clients.errors.contactNotFound"))

    const blocker = resolveRestoreBlocker([
      { label: t("trash.entities.client"), deletedAt: existing.clientDeletedAt }
    ])

    if (blocker) {
      throw new ExpectedClientError(t("trash.errors.restoreBlocked", { parent: blocker }))
    }

    // The deleted row may still carry `is_primary`, and `uq_client_contacts_primary` ignores
    // soft-deleted rows — so if somebody promoted a replacement in the meantime, restoring the flag
    // as it stood would violate the index. The contact comes back as an ordinary one and the
    // current primary keeps the slot.
    const primaryTaken =
      existing.isPrimary &&
      Boolean(
        await database.query.clientContacts.findFirst({
          columns: { id: true },
          where: and(
            eq(clientContacts.clientId, existing.clientId),
            eq(clientContacts.isPrimary, true),
            isNull(clientContacts.deletedAt)
          )
        })
      )

    const [restored] = await database
      .update(clientContacts)
      .set({ deletedAt: null, isPrimary: existing.isPrimary && !primaryTaken })
      .where(and(eq(clientContacts.id, existing.id), isNotNull(clientContacts.deletedAt)))
      .returning({ id: clientContacts.id, clientId: clientContacts.clientId })

    if (!restored) throw new ExpectedClientError(t("clients.errors.contactNotFound"))

    await writeClientContactAudit(context, "client_contact.restored", restored.id, {
      clientId: restored.clientId
    })

    revalidatePath(`${clientsPath}/${restored.clientId}`)

    return { data: { id: restored.id } }
  } catch (error) {
    return handleClientContactActionError(error, "restoreClientContact", context.userId)
  }
}
