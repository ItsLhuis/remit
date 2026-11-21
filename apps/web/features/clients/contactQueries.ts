import { and, asc, desc, eq, isNull } from "drizzle-orm"

import { database } from "@/database"
import { clientContacts, clients } from "@/database/schema"

import { clientIdSchema } from "./schemas"
import { listRecipientIdentities, resolveDocumentRecipient, type ClientRecipient } from "./services"
import { type ClientContact } from "./types"

// The contact reads, beside `queries.ts` rather than inside it, for the reason
// `features/proposals/publicQueries.ts` gives for its own split: `queries.ts` is at the file-length
// ceiling and one more read would push it over.

type ClientContactRow = typeof clientContacts.$inferSelect

type ClientRecipientContext = {
  client: { id: string; name: string; email: string }
  contacts: ClientContactRow[]
}

export async function listClientContacts(input: unknown): Promise<ClientContact[]> {
  const parsed = clientIdSchema.safeParse(input)

  if (!parsed.success) return []

  const rows = await listLiveContacts(parsed.data.id)

  return rows.map(toClientContact)
}

export async function getClientDocumentRecipient(
  clientId: string | null
): Promise<ClientRecipient | null> {
  const context = await getClientRecipientContext(clientId)

  if (!context) return null

  return resolveDocumentRecipient(context.client, context.contacts)
}

export async function listClientRecipientIdentities(
  clientId: string | null
): Promise<ClientRecipient[]> {
  const context = await getClientRecipientContext(clientId)

  if (!context) return []

  return listRecipientIdentities(context.client, context.contacts)
}

// A soft-deleted client has no recipients at all, not even its own address: its documents are
// already unreachable, and an identity list built from a dead row would let an address that the
// workspace no longer shows keep answering for it.
async function getClientRecipientContext(
  clientId: string | null
): Promise<ClientRecipientContext | null> {
  if (!clientId) return null

  const [client, contacts] = await Promise.all([
    database.query.clients.findFirst({
      columns: { id: true, name: true, email: true },
      where: and(eq(clients.id, clientId), isNull(clients.deletedAt))
    }),
    listLiveContacts(clientId)
  ])

  if (!client) return null

  return { client, contacts }
}

function listLiveContacts(clientId: string): Promise<ClientContactRow[]> {
  return database
    .select()
    .from(clientContacts)
    .where(and(eq(clientContacts.clientId, clientId), isNull(clientContacts.deletedAt)))
    .orderBy(desc(clientContacts.isPrimary), asc(clientContacts.name))
}

function toClientContact(row: ClientContactRow): ClientContact {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    role: row.role ?? "",
    isPrimary: row.isPrimary,
    createdAt: row.createdAt
  }
}
