import { desc, eq, getTableColumns, inArray, or, sql, type SQL } from "drizzle-orm"
import { type PgColumn, type PgTable } from "drizzle-orm/pg-core"

import { database } from "@/database"
import {
  activityLogs,
  auditLogs,
  clients,
  contracts,
  contractSignatures,
  creditNotes,
  dataExports,
  emailLogs,
  expenses,
  invoices,
  leads,
  lineItems,
  payments,
  projects,
  proposals,
  recurringInvoices,
  settings,
  tasks,
  taxRates,
  templates,
  timeEntries,
  uploads
} from "@/database/schema"

import { dataExportIdSchema, type DataExportScope } from "./schemas"
import {
  ACTIVE_DATA_EXPORT_STATUSES,
  getExportTables,
  toDataExportFailureReason,
  type ExportTableManifest
} from "./services"
import {
  type DataExportArchive,
  type DataExportClientOption,
  type DataExportListItem,
  type DataExportPageData
} from "./types"

// How many past exports the page shows. The list is a receipt of what left the instance, not a
// browsable archive: older rows stay in `data_exports` and in `audit_logs`.
const DATA_EXPORT_HISTORY_LIMIT = 20

// The manifest names tables by their database name; this is the one place those names bind to Drizzle
// table objects. A manifest entry with no source here fails loudly in `readExportRows` rather than
// silently exporting one file fewer.
const EXPORT_TABLE_SOURCES: Record<string, PgTable> = {
  activity_logs: activityLogs,
  audit_logs: auditLogs,
  clients,
  contract_signatures: contractSignatures,
  contracts,
  credit_notes: creditNotes,
  data_exports: dataExports,
  email_logs: emailLogs,
  expenses,
  invoices,
  leads,
  line_items: lineItems,
  payments,
  projects,
  proposals,
  recurring_invoices: recurringInvoices,
  settings,
  tasks,
  tax_rates: taxRates,
  templates,
  time_entries: timeEntries,
  uploads
}

export type ExportRowsByTable = Record<string, Record<string, unknown>[]>

export async function getDataExportPageData(): Promise<DataExportPageData> {
  const [rows, clientOptions, instanceSettings] = await Promise.all([
    database.query.dataExports.findMany({
      with: { client: { columns: { name: true } } },
      orderBy: [desc(dataExports.createdAt)],
      limit: DATA_EXPORT_HISTORY_LIMIT
    }),
    listExportClientOptions(),
    database.query.settings.findFirst({
      columns: { defaultLocale: true, defaultTimezone: true }
    })
  ])

  return {
    clients: clientOptions,
    exports: rows.map(toDataExportListItem),
    hasActiveExport: rows.some((row) =>
      ACTIVE_DATA_EXPORT_STATUSES.some((status) => status === row.status)
    ),
    locale: instanceSettings?.defaultLocale ?? "en",
    timeZone: instanceSettings?.defaultTimezone ?? "UTC"
  }
}

// The download route's only read. It returns nothing for an export that is still assembling or that
// failed, so a guessed id cannot be used to probe for an archive that is not there yet.
export async function getDataExportArchive(input: unknown): Promise<DataExportArchive | null> {
  const parsed = dataExportIdSchema.safeParse(input)

  if (!parsed.success) return null

  const row = await database.query.dataExports.findFirst({
    columns: { filename: true, sizeBytes: true, status: true, storageKey: true },
    where: eq(dataExports.id, parsed.data.exportId)
  })

  if (row?.status !== "ready" || !row.storageKey || !row.filename) return null

  return { filename: row.filename, sizeBytes: row.sizeBytes, storageKey: row.storageKey }
}

// Every read below deliberately omits the `isNull(deletedAt)` filter every other feature applies: a
// soft-deleted record still exists in the instance, so a portability export that hid it would be
// incomplete. The `deletedAt` column travels with the row, which is what lets a recipient tell the
// trash apart from the live data.
export async function readInstanceExportRows(): Promise<ExportRowsByTable> {
  const manifests = getExportTables("instance")
  const results = await Promise.all(manifests.map((manifest) => readExportRows(manifest, null)))

  return toRowsByTable(manifests, results)
}

export async function readClientExportRows(clientId: string): Promise<ExportRowsByTable | null> {
  const client = await database.query.clients.findFirst({
    columns: { id: true },
    where: eq(clients.id, clientId)
  })

  if (!client) return null

  const subgraph = await readClientSubgraph(clientId)
  const manifests = getExportTables("client")

  const results = await Promise.all(
    manifests.map((manifest) =>
      readExportRows(manifest, buildClientScope(manifest, clientId, subgraph))
    )
  )

  return toRowsByTable(manifests, results)
}

type DataExportRow = {
  id: string
  scope: DataExportScope
  status: DataExportListItem["status"]
  progress: number
  sizeBytes: number | null
  entryCount: number | null
  failureReason: string | null
  createdAt: Date
  completedAt: Date | null
  client: { name: string } | null
}

function toDataExportListItem(row: DataExportRow): DataExportListItem {
  return {
    id: row.id,
    scope: row.scope,
    clientName: row.client?.name ?? null,
    status: row.status,
    progress: row.progress,
    sizeBytes: row.sizeBytes,
    entryCount: row.entryCount,
    failureReason: toDataExportFailureReason(row.failureReason),
    requestedAt: row.createdAt,
    completedAt: row.completedAt
  }
}

async function listExportClientOptions(): Promise<DataExportClientOption[]> {
  return await database
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .orderBy(clients.name)
}

async function readExportRows(
  manifest: ExportTableManifest,
  where: SQL | undefined | null
): Promise<Record<string, unknown>[]> {
  const table = EXPORT_TABLE_SOURCES[manifest.table]

  if (!table) throw new Error(`No export source registered for table "${manifest.table}"`)

  // Selecting the manifest's columns rather than the whole row is the difference between excluding a
  // secret and merely not writing it: `settings.smtpPass` and the rest of the `encryptedColumn()`
  // fields are never decrypted at all, because the SELECT never asks for them. `clients.notes` is the
  // one encrypted column that is asked for, and it lands in the archive as plaintext on purpose.
  const query = database.select(toManifestProjection(table, manifest)).from(table)

  return where ? await query.where(where) : await query
}

function toManifestProjection(
  table: PgTable,
  manifest: ExportTableManifest
): Record<string, PgColumn> {
  const available: Record<string, PgColumn> = getTableColumns(table)
  const projection: Record<string, PgColumn> = {}

  for (const column of manifest.columns) {
    const source = available[column]

    if (!source) {
      throw new Error(`Export manifest for "${manifest.table}" names unknown column "${column}"`)
    }

    projection[column] = source
  }

  return projection
}

function toRowsByTable(
  manifests: readonly ExportTableManifest[],
  results: readonly Record<string, unknown>[][]
): ExportRowsByTable {
  const rowsByTable: ExportRowsByTable = {}

  manifests.forEach((manifest, index) => {
    rowsByTable[manifest.table] = results[index] ?? []
  })

  return rowsByTable
}

type ClientSubgraph = {
  contractIds: string[]
  creditNoteIds: string[]
  documentIds: string[]
  entityIds: string[]
  invoiceIds: string[]
  projectIds: string[]
  proposalIds: string[]
  uploadIds: string[]
}

// The id sets a client-scoped export is built from. Read in three waves because each wave's `where`
// needs the previous one's ids: projects come from the client, documents from the projects, and the
// per-document children from the documents.
async function readClientSubgraph(clientId: string): Promise<ClientSubgraph> {
  const projectIds = await selectIds(
    database.select({ id: projects.id }).from(projects).where(eq(projects.clientId, clientId))
  )

  const [invoiceIds, proposalIds, contractIds, taskIds, timeEntryIds, expenseRows] =
    await Promise.all([
      selectIds(
        database
          .select({ id: invoices.id })
          .from(invoices)
          .where(or(eq(invoices.clientId, clientId), withinIdSet(invoices.projectId, projectIds)))
      ),
      selectIds(
        database
          .select({ id: proposals.id })
          .from(proposals)
          .where(withinIdSet(proposals.projectId, projectIds))
      ),
      selectIds(
        database
          .select({ id: contracts.id })
          .from(contracts)
          .where(or(eq(contracts.clientId, clientId), withinIdSet(contracts.projectId, projectIds)))
      ),
      selectIds(
        database
          .select({ id: tasks.id })
          .from(tasks)
          .where(withinIdSet(tasks.projectId, projectIds))
      ),
      selectIds(
        database
          .select({ id: timeEntries.id })
          .from(timeEntries)
          .where(withinIdSet(timeEntries.projectId, projectIds))
      ),
      database
        .select({ id: expenses.id, receiptUploadId: expenses.receiptUploadId })
        .from(expenses)
        .where(or(eq(expenses.clientId, clientId), withinIdSet(expenses.projectId, projectIds)))
    ])

  const [creditNoteIds, paymentIds, signatureUploadIds] = await Promise.all([
    selectIds(
      database
        .select({ id: creditNotes.id })
        .from(creditNotes)
        .where(withinIdSet(creditNotes.invoiceId, invoiceIds))
    ),
    selectIds(
      database
        .select({ id: payments.id })
        .from(payments)
        .where(withinIdSet(payments.invoiceId, invoiceIds))
    ),
    database
      .select({ uploadId: contractSignatures.signedPdfUploadId })
      .from(contractSignatures)
      .where(withinIdSet(contractSignatures.contractId, contractIds))
  ])

  const documentIds = [...invoiceIds, ...proposalIds, ...contractIds]

  return {
    contractIds,
    creditNoteIds,
    documentIds,
    // `activity_logs` is polymorphic on (entityType, entityId) with no foreign key, so the only way to
    // scope it to one client is to name every id in that client's subgraph.
    entityIds: [
      clientId,
      ...projectIds,
      ...taskIds,
      ...timeEntryIds,
      ...expenseRows.map((row) => row.id),
      ...paymentIds,
      ...documentIds,
      ...creditNoteIds
    ],
    invoiceIds,
    projectIds,
    proposalIds,
    uploadIds: [
      ...expenseRows.flatMap((row) => (row.receiptUploadId ? [row.receiptUploadId] : [])),
      ...signatureUploadIds.flatMap((row) => (row.uploadId ? [row.uploadId] : []))
    ]
  }
}

function buildClientScope(
  manifest: ExportTableManifest,
  clientId: string,
  subgraph: ClientSubgraph
): SQL | undefined {
  switch (manifest.table) {
    case "clients":
      return eq(clients.id, clientId)
    case "leads":
      return eq(leads.convertedToClientId, clientId)
    case "projects":
      return eq(projects.clientId, clientId)
    case "tasks":
      return withinIdSet(tasks.projectId, subgraph.projectIds)
    case "time_entries":
      return withinIdSet(timeEntries.projectId, subgraph.projectIds)
    case "expenses":
      return or(
        eq(expenses.clientId, clientId),
        withinIdSet(expenses.projectId, subgraph.projectIds)
      )
    case "proposals":
      return withinIdSet(proposals.projectId, subgraph.projectIds)
    case "contracts":
      return or(
        eq(contracts.clientId, clientId),
        withinIdSet(contracts.projectId, subgraph.projectIds)
      )
    case "contract_signatures":
      return withinIdSet(contractSignatures.contractId, subgraph.contractIds)
    case "recurring_invoices":
      return or(
        eq(recurringInvoices.clientId, clientId),
        withinIdSet(recurringInvoices.projectId, subgraph.projectIds)
      )
    case "invoices":
      return or(
        eq(invoices.clientId, clientId),
        withinIdSet(invoices.projectId, subgraph.projectIds)
      )
    case "line_items":
      return or(
        withinIdSet(lineItems.proposalId, subgraph.proposalIds),
        withinIdSet(lineItems.invoiceId, subgraph.invoiceIds),
        withinIdSet(lineItems.creditNoteId, subgraph.creditNoteIds)
      )
    case "payments":
      return withinIdSet(payments.invoiceId, subgraph.invoiceIds)
    case "credit_notes":
      return withinIdSet(creditNotes.invoiceId, subgraph.invoiceIds)
    case "activity_logs":
      return withinIdSet(activityLogs.entityId, subgraph.entityIds)
    case "email_logs":
      return withinIdSet(emailLogs.documentId, subgraph.documentIds)
    case "uploads":
      return withinIdSet(uploads.id, subgraph.uploadIds)
    default:
      // Reached only by a manifest entry that declared the `client` scope without a rule here, which
      // would otherwise export the whole table into a one-client archive.
      throw new Error(`No client scope rule for exported table "${manifest.table}"`)
  }
}

// `inArray(column, [])` is valid Drizzle, but reading it at seventeen call sites leaves the question
// "does an empty set match everything?" open every time. Stating the false predicate once closes it.
function withinIdSet(column: PgColumn, ids: readonly string[]): SQL {
  return ids.length > 0 ? inArray(column, [...ids]) : sql`false`
}

async function selectIds(query: Promise<{ id: string }[]>): Promise<string[]> {
  return (await query).map((row) => row.id)
}
