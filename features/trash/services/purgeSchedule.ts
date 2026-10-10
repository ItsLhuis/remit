import { getPurgeDueAt, type RetentionPolicy, type RetentionWindow } from "./retentionWindow"

// A document that names a client, as far as the purge cares: which window governs it, whether it
// is in the trash yet, and whether it is a contract a counterparty has signed.
export type NamingDocument = {
  window: RetentionWindow
  deletedAt: Date | null
  countersigned: boolean
}

export type PurgeSubject =
  | { kind: "record"; window: RetentionWindow; deletedAt: Date }
  | { kind: "contract"; deletedAt: Date; countersigned: boolean }
  | { kind: "client"; deletedAt: Date; namingDocuments: readonly NamingDocument[] }

export type PurgeSchedule =
  // `heldByDocuments` is true when the documents naming a client set the date rather than the
  // client's own window, which is the one case where the date shown is later than the window implies.
  | { status: "scheduled"; dueAt: Date; heldByDocuments: boolean }
  | { status: "windowUnset" }
  | { status: "heldByLiveDocuments"; documentCount: number }
  | { status: "never"; reason: "countersigned" | "countersignedContractNamesClient" }

// The one statement of when the retention purge removes a deleted record. `features/trash/purge.ts`
// decides what to delete with it and `features/trash/queries.ts` dates the trash with it, so the date
// on the surface and the day the row goes cannot disagree.
//
// Two schema facts make this more than "deleted at plus the window" (ADR-0034). A countersigned
// contract is never purged, because deleting it would cascade into an insert-only signature. And a
// client is never removed while a document names it, because that nulls the document's `client_id`
// and the parent checks reject the statement; the purge walks documents before clients, so a client
// goes on the first run after both its own window and every naming document's window have passed.
export function resolvePurgeSchedule(
  subject: PurgeSubject,
  policy: RetentionPolicy
): PurgeSchedule {
  switch (subject.kind) {
    case "record":
      return scheduleWithin(subject.deletedAt, policy, subject.window)
    case "contract":
      if (subject.countersigned) return { status: "never", reason: "countersigned" }

      return scheduleWithin(subject.deletedAt, policy, "financial")
    case "client":
      return scheduleClient(subject.deletedAt, subject.namingDocuments, policy)
  }
}

export function isPurgeDue(schedule: PurgeSchedule, now: Date): boolean {
  return schedule.status === "scheduled" && schedule.dueAt.getTime() <= now.getTime()
}

function scheduleWithin(
  deletedAt: Date,
  policy: RetentionPolicy,
  window: RetentionWindow
): PurgeSchedule {
  const dueAt = getPurgeDueAt(deletedAt, policy, window)

  if (!dueAt) return { status: "windowUnset" }

  return { status: "scheduled", dueAt, heldByDocuments: false }
}

function scheduleClient(
  deletedAt: Date,
  namingDocuments: readonly NamingDocument[],
  policy: RetentionPolicy
): PurgeSchedule {
  // Checked before anything else, live or deleted: a signed contract can never leave, so the client
  // it names can never leave either, whatever the other documents and windows say.
  if (namingDocuments.some((document) => document.countersigned)) {
    return { status: "never", reason: "countersignedContractNamesClient" }
  }

  const liveDocumentCount = namingDocuments.filter((document) => !document.deletedAt).length

  if (liveDocumentCount > 0) {
    return { status: "heldByLiveDocuments", documentCount: liveDocumentCount }
  }

  const own = getPurgeDueAt(deletedAt, policy, "trash")

  if (!own) return { status: "windowUnset" }

  let dueAt = own

  for (const document of namingDocuments) {
    const documentDueAt = document.deletedAt
      ? getPurgeDueAt(document.deletedAt, policy, document.window)
      : null

    if (!documentDueAt) return { status: "windowUnset" }

    if (documentDueAt.getTime() > dueAt.getTime()) dueAt = documentDueAt
  }

  return { status: "scheduled", dueAt, heldByDocuments: dueAt.getTime() > own.getTime() }
}
