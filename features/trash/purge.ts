import { and, count, eq, exists, isNotNull, lt, not, type SQL } from "drizzle-orm"
import { type PgColumn, type PgTable } from "drizzle-orm/pg-core"

import { writeAudit } from "@/lib/audit"

import { database } from "@/database"
import {
  clientContacts,
  clients,
  contracts,
  contractSignatures,
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

import { getPurgeCutoff, type RetentionPolicy, type RetentionWindow } from "./services"

export type RetentionPurgeEntry = {
  table: string
  window: RetentionWindow
  rows: number
}

export type RetentionPurgeResult = {
  entries: RetentionPurgeEntry[]
  totalRows: number
}

type PurgeSource = {
  table: PgTable
  deletedAt: PgColumn
  // Rows the purge must leave behind however old they are, because removing them would break
  // something the window has no authority over: an insert-only record, or a check constraint on a
  // row that survives. Both guards below are that, and both would fail the whole transaction rather
  // than one row.
  protect?: SQL
}

// Deleting a contract cascades to `contract_signatures`, whose BEFORE DELETE trigger from
// `0001_insert_only_guards.sql` raises — correctly: a counterparty's signature is a record of
// something they did, not a row Remit owns. A signed contract therefore stays in the trash for good
// rather than being purged, and the reset command's trigger-lifting is deliberately not copied here:
// a reset is an operator typing the instance name, and this sweep runs unattended at 02:30.
const signedContractGuard = not(
  exists(
    database
      .select({ one: contractSignatures.id })
      .from(contractSignatures)
      .where(eq(contractSignatures.contractId, contracts.id))
  )
)

// A client is the last parent standing, so purging one while any document still names it would set
// that document's `client_id` to null and violate `chk_invoices_parent` and its two siblings — the
// whole transaction, not one row. The window that governs those documents is the longer one, so this
// is the ordinary case rather than an edge: a client is purged only once every document naming it has
// been purged first.
const parentlessDocumentGuard = and(
  not(
    exists(
      database.select({ one: invoices.id }).from(invoices).where(eq(invoices.clientId, clients.id))
    )
  ),
  not(
    exists(
      database
        .select({ one: proposals.id })
        .from(proposals)
        .where(eq(proposals.clientId, clients.id))
    )
  ),
  not(
    exists(
      database
        .select({ one: contracts.id })
        .from(contracts)
        .where(eq(contracts.clientId, clients.id))
    )
  )
)

const PURGE_SOURCES: Record<string, PurgeSource> = {
  payments: { table: payments, deletedAt: payments.deletedAt },
  credit_notes: { table: creditNotes, deletedAt: creditNotes.deletedAt },
  contracts: { table: contracts, deletedAt: contracts.deletedAt, protect: signedContractGuard },
  invoices: { table: invoices, deletedAt: invoices.deletedAt },
  proposals: { table: proposals, deletedAt: proposals.deletedAt },
  recurring_invoices: { table: recurringInvoices, deletedAt: recurringInvoices.deletedAt },
  expenses: { table: expenses, deletedAt: expenses.deletedAt },
  time_entries: { table: timeEntries, deletedAt: timeEntries.deletedAt },
  tasks: { table: tasks, deletedAt: tasks.deletedAt },
  projects: { table: projects, deletedAt: projects.deletedAt },
  leads: { table: leads, deletedAt: leads.deletedAt },
  client_contacts: { table: clientContacts, deletedAt: clientContacts.deletedAt },
  clients: { table: clients, deletedAt: clients.deletedAt, protect: parentlessDocumentGuard },
  tax_rates: { table: taxRates, deletedAt: taxRates.deletedAt },
  templates: { table: templates, deletedAt: templates.deletedAt }
}

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
  const entries: RetentionPurgeEntry[] = []

  for (const { table, window } of getPurgeOrder()) {
    const where = buildPurgeCondition(table, policy, window, now)

    if (!where) continue

    const [row] = await database.select({ value: count() }).from(source(table).table).where(where)

    entries.push({ table, window, rows: row?.value ?? 0 })
  }

  return { entries, totalRows: entries.reduce((total, entry) => total + entry.rows, 0) }
}

export async function runRetentionPurge(
  policy: RetentionPolicy,
  now: Date
): Promise<RetentionPurgeResult> {
  if (policy.trashDays === null && policy.financialDays === null) {
    return { entries: [], totalRows: 0 }
  }

  return database.transaction(async (transaction) => {
    const entries: RetentionPurgeEntry[] = []

    for (const { table, window } of getPurgeOrder()) {
      const where = buildPurgeCondition(table, policy, window, now)

      if (!where) continue

      // Counted inside the transaction, before the delete that changes it, so the audit entry states
      // what this purge actually removed rather than what a later reader would infer.
      const [row] = await transaction
        .select({ value: count() })
        .from(source(table).table)
        .where(where)

      const rows = row?.value ?? 0

      if (rows === 0) continue

      await transaction.delete(source(table).table).where(where)

      entries.push({ table, window, rows })
    }

    const totalRows = entries.reduce((total, entry) => total + entry.rows, 0)

    if (totalRows > 0) {
      // Inside the transaction with the deletes it records, exactly as `runResetData` does: a
      // rollback takes the entry with it, so no entry can claim a purge that did not happen.
      await writeAudit("retention.purge.completed", {
        targetEntityType: "settings",
        metadata: {
          retentionTrashDays: policy.trashDays,
          retentionFinancialDays: policy.financialDays,
          deletedCounts: Object.fromEntries(entries.map((entry) => [entry.table, entry.rows]))
        }
      })
    }

    return { entries, totalRows }
  })
}

function source(table: string): PurgeSource {
  const purgeSource = PURGE_SOURCES[table]

  if (!purgeSource) throw new Error(`No purge source registered for table "${table}"`)

  return purgeSource
}

function buildPurgeCondition(
  table: string,
  policy: RetentionPolicy,
  window: RetentionWindow,
  now: Date
): SQL | undefined {
  const cutoff = getPurgeCutoff(policy, window, now)

  if (!cutoff) return undefined

  const purgeSource = source(table)

  return and(
    isNotNull(purgeSource.deletedAt),
    lt(purgeSource.deletedAt, cutoff),
    purgeSource.protect
  )
}
