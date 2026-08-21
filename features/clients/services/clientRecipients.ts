export type ClientRecipient = {
  email: string
  name: string
}

export type RecipientClient = {
  name: string
  email: string
}

export type RecipientContact = {
  name: string
  email: string
  isPrimary: boolean
}

// Where a document is sent. `clients.email` stays the billing default and the fallback; a live
// primary contact displaces it as the envelope address, and nothing about that choice is persisted
// on the document — it is re-resolved at every send, and `email_logs.recipient_email` is the record
// of where each one actually went (ADR-0027).
export function resolveDocumentRecipient(
  client: RecipientClient,
  contacts: RecipientContact[]
): ClientRecipient {
  const primary = contacts.find((contact) => contact.isPrimary)

  if (!primary) return { email: client.email, name: client.name }

  return { email: primary.email, name: primary.name }
}

// Every address allowed to answer this client's documents: the client's own, then each live
// contact. Both arguments come from a single client's rows, which is the whole reason a contact of
// another client can never match — see `features/proposals/publicResponse.ts`.
export function listRecipientIdentities(
  client: RecipientClient,
  contacts: RecipientContact[]
): ClientRecipient[] {
  return [
    { email: client.email, name: client.name },
    ...contacts.map((contact) => ({ email: contact.email, name: contact.name }))
  ]
}
