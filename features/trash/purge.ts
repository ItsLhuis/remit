import { and, inArray, isNotNull, lte } from "drizzle-orm"
import { type PgColumn, type PgTable } from "drizzle-orm/pg-core"

import {
  drainObjectDeletions,
  readUploadReferences,
  releaseObjects
} from "@/lib/storage/objectDeletions"

import { database } from "@/database"
import {
  auditLogs,
  clientContacts,
  clients,
  contracts,
  creditNotes,
  expenses,
  invoices,
  leads,
  payments,
  projects,
  proposals,
  recurringInvoices,
  tasks,
  taxRates,
  templates,
  timeEntries
} from "@/database/schema"

import { DOMAIN_DATA_INVENTORY } from "@/scripts/core/domainData/inventory"

import { readCountersignedContractIds, readNamingDocuments } from "./purgeFacts"
import {
  getPurgeCutoff,
  isPurgeDue,
  resolvePurgeSchedule,
  type PurgeSubject,
  type RetentionPolicy,
  type RetentionWindow
} from "./services"

export type RetentionPurgeEntry = {
  table: string
  window: RetentionWindow
  rows: number
}

export type RetentionPurgeResult = {
  entries: RetentionPurgeEntry[]
  totalRows: number
  storageObjects: number
}

type PurgeSource = {
  table: PgTable
  id: PgColumn
  deletedAt: PgColumn
}

type PurgeExecutor = Pick<typeof database, "select" | "selectDistinct">

type DuePurge = {
  table: string
  window: RetentionWindow
  ids: string[]
}

const PURGE_SOURCES: Record<string, PurgeSource> = {
  payments: { table: payments, id: payments.id, deletedAt: payments.deletedAt },
  credit_notes: { table: creditNotes, id: creditNotes.id, deletedAt: creditNotes.deletedAt },
  contracts: { table: contracts, id: contracts.id, deletedAt: contracts.deletedAt },
  invoices: { table: invoices, id: invoices.id, deletedAt: invoices.deletedAt },
  proposals: { table: proposals, id: proposals.id, deletedAt: proposals.deletedAt },
  recurring_invoices: {
    table: recurringInvoices,
    id: recurringInvoices.id,
    deletedAt: recurringInvoices.deletedAt
  },
  expenses: { table: expenses, id: expenses.id, deletedAt: expenses.deletedAt },
  time_entries: { table: timeEntries, id: timeEntries.id, deletedAt: timeEntries.deletedAt },
  tasks: { table: tasks, id: tasks.id, deletedAt: tasks.deletedAt },
  projects: { table: projects, id: projects.id, deletedAt: projects.deletedAt },
  leads: { table: leads, id: leads.id, deletedAt: leads.deletedAt },
  client_contacts: {
    table: clientContacts,
    id: clientContacts.id,
    deletedAt: clientContacts.deletedAt
  },
  clients: { table: clients, id: clients.id, deletedAt: clients.deletedAt },
  tax_rates: { table: taxRates, id: taxRates.id, deletedAt: taxRates.deletedAt },
  templates: { table: templates, id: templates.id, deletedAt: templates.deletedAt }
}

const ID_CHUNK_SIZE = 1000

// The inventory's array order is the FK-safe delete order (children before parents), and this walks
// it directly rather than keeping a second list that could drift from the one both CLI commands
// already share. A restorable table with no source above fails the purge loudly instead of being
// skipped silently.
export function getPurgeOrder(): ReadonlyArray<{ table: string; window: RetentionWindow }> {
  return DOMAIN_DATA_INVENTORY.flatMap((entry) =>
    entry.trash === "restorable"
      ? [{ table: entry.table, window: entry.retention === "financial" ? "financial" : "trash" }]
      : []
  )
}

export async function planRetentionPurge(
  policy: RetentionPolicy,
  now: Date
): Promise<RetentionPurgeResult> {
  const due = await selectDuePurges(database, policy, now)

  return { ...summarize(due), storageObjects: 0 }
}

// One transaction for the deletes, the release of the objects they owned and the audit entry, at
// repeatable read: the uploads a purge releases are the difference between what was referenced
// before its deletes and after them (`lib/storage/objectOwnership.ts`), and only a single snapshot
// keeps another session's concurrent writes out of that difference. A conflicting write fails the
// purge, and BullMQ's retry runs it again against the new state.
export async function runRetentionPurge(
  policy: RetentionPolicy,
  now: Date
): Promise<RetentionPurgeResult> {
  if (policy.trashDays === null && policy.financialDays === null) {
    return { entries: [], totalRows: 0, storageObjects: 0 }
  }

  const outcome = await database.transaction(
    async (transaction) => {
      const due = await selectDuePurges(transaction, policy, now)
      const { entries, totalRows } = summarize(due)

      if (totalRows === 0) return { entries, totalRows, storageObjects: 0, deletionIds: [] }

      const referencedBefore = await readUploadReferences(transaction)

      for (const { table, ids } of due) {
        const purgeSource = source(table)

        for (const chunk of chunked(ids)) {
          await transaction.delete(purgeSource.table).where(inArray(purgeSource.id, chunk))
        }
      }

      const release = await releaseObjects(transaction, { referencedBefore })

      // Written through the transaction rather than `writeAudit`, which inserts on its own
      // connection: a rollback must take the entry with the deletes it records, so no entry can
      // claim a purge that did not happen. Counts only — never a key or a record's content.
      await transaction.insert(auditLogs).values({
        event: "retention.purge.completed",
        targetEntityType: "settings",
        metadata: {
          retentionTrashDays: policy.trashDays,
          retentionFinancialDays: policy.financialDays,
          deletedCounts: Object.fromEntries(entries.map((entry) => [entry.table, entry.rows])),
          storageObjects: release.objects
        }
      })

      return {
        entries,
        totalRows,
        storageObjects: release.objects,
        deletionIds: release.deletionIds
      }
    },
    { isolationLevel: "repeatable read" }
  )

  // After the commit, so nothing leaves the bucket unless the rows that owned it are gone for good.
  await drainObjectDeletions({ ids: outcome.deletionIds })

  return {
    entries: outcome.entries,
    totalRows: outcome.totalRows,
    storageObjects: outcome.storageObjects
  }
}

// Every due row, table by table in purge order, decided by the same `resolvePurgeSchedule` the trash
// dates rows with. The window cutoff only narrows the read; the rule decides. Documents found due
// are remembered so a client they name is judged as the purge will find it — after they are gone.
async function selectDuePurges(
  executor: PurgeExecutor,
  policy: RetentionPolicy,
  now: Date
): Promise<DuePurge[]> {
  const due: DuePurge[] = []
  const dueDocumentIds = new Set<string>()

  for (const { table, window } of getPurgeOrder()) {
    const cutoff = getPurgeCutoff(policy, window, now)

    if (!cutoff) continue

    const purgeSource = source(table)

    const rows = await executor
      .select({ id: purgeSource.id, deletedAt: purgeSource.deletedAt })
      .from(purgeSource.table)
      .where(and(isNotNull(purgeSource.deletedAt), lte(purgeSource.deletedAt, cutoff)))

    const candidates = rows.flatMap((row) =>
      typeof row.id === "string" && row.deletedAt instanceof Date
        ? [{ id: row.id, deletedAt: row.deletedAt }]
        : []
    )

    const subjects = await toPurgeSubjects(executor, { table, window, candidates, dueDocumentIds })

    const ids = subjects
      .filter(({ subject }) => isPurgeDue(resolvePurgeSchedule(subject, policy), now))
      .map(({ id }) => id)

    if (ids.length === 0) continue

    due.push({ table, window, ids })

    if (table === "invoices" || table === "proposals" || table === "contracts") {
      for (const id of ids) dueDocumentIds.add(id)
    }
  }

  return due
}

type PurgeCandidates = {
  table: string
  window: RetentionWindow
  candidates: Array<{ id: string; deletedAt: Date }>
  dueDocumentIds: ReadonlySet<string>
}

async function toPurgeSubjects(
  executor: PurgeExecutor,
  { table, window, candidates, dueDocumentIds }: PurgeCandidates
): Promise<Array<{ id: string; subject: PurgeSubject }>> {
  const ids = candidates.map((candidate) => candidate.id)

  if (table === "contracts") {
    const countersigned = await readCountersignedContractIds(executor, ids)

    return candidates.map(({ id, deletedAt }) => ({
      id,
      subject: { kind: "contract", deletedAt, countersigned: countersigned.has(id) }
    }))
  }

  if (table === "clients") {
    const namingDocuments = await readNamingDocuments(executor, ids, dueDocumentIds)

    return candidates.map(({ id, deletedAt }) => ({
      id,
      subject: { kind: "client", deletedAt, namingDocuments: namingDocuments.get(id) ?? [] }
    }))
  }

  return candidates.map(({ id, deletedAt }) => ({
    id,
    subject: { kind: "record", window, deletedAt }
  }))
}

function summarize(due: DuePurge[]): Pick<RetentionPurgeResult, "entries" | "totalRows"> {
  const entries = due.map(({ table, window, ids }) => ({ table, window, rows: ids.length }))

  return { entries, totalRows: entries.reduce((total, entry) => total + entry.rows, 0) }
}

function source(table: string): PurgeSource {
  const purgeSource = PURGE_SOURCES[table]

  if (!purgeSource) throw new Error(`No purge source registered for table "${table}"`)

  return purgeSource
}

function chunked(values: string[]): string[][] {
  const chunks: string[][] = []

  for (let index = 0; index < values.length; index += ID_CHUNK_SIZE) {
    chunks.push(values.slice(index, index + ID_CHUNK_SIZE))
  }

  return chunks
}
