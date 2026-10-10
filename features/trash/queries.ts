import { and, eq, isNotNull, sql, type SQL } from "drizzle-orm"
import { type PgColumn, type PgTable } from "drizzle-orm/pg-core"

import { z } from "zod"

import { database } from "@/database"
import {
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

import { readCountersignedContractIds, readNamingDocuments } from "./purgeFacts"
import {
  parseTrashListQuery,
  TRASH_ENTITY_KINDS,
  type TrashEntityKind,
  type TrashListQuery
} from "./schemas"
import {
  resolvePurgeSchedule,
  type NamingDocument,
  type PurgeSchedule,
  type PurgeSubject,
  type RetentionPolicy,
  type RetentionWindow
} from "./services"
import { type TrashSectionData } from "./types"

const UNTITLED_RECORD = "—"

type TrashExpression = PgColumn | SQL<string | null>

type TrashSource = {
  kind: TrashEntityKind
  // The inventory's `retention` decision for this table, restated as the value the read model
  // carries so the surface can date every row without consulting a second list.
  window: RetentionWindow
  table: PgTable
  id: PgColumn
  deletedAt: PgColumn
  title: TrashExpression
  // What the record hung off — a client name, an invoice number — so two rows with the same title
  // are still tellable apart in one undifferentiated list.
  context: TrashExpression
  parent?: { table: PgTable; on: SQL }
}

const TRASH_SOURCES: TrashSource[] = [
  {
    kind: "client",
    window: "trash",
    table: clients,
    id: clients.id,
    deletedAt: clients.deletedAt,
    title: clients.name,
    context: sql`null`
  },
  {
    kind: "clientContact",
    window: "trash",
    table: clientContacts,
    id: clientContacts.id,
    deletedAt: clientContacts.deletedAt,
    title: clientContacts.name,
    context: clients.name,
    parent: { table: clients, on: eq(clients.id, clientContacts.clientId) }
  },
  {
    kind: "lead",
    window: "trash",
    table: leads,
    id: leads.id,
    deletedAt: leads.deletedAt,
    title: sql`${leads.firstName} || ' ' || ${leads.lastName}`,
    context: leads.company
  },
  {
    kind: "project",
    window: "trash",
    table: projects,
    id: projects.id,
    deletedAt: projects.deletedAt,
    title: projects.name,
    context: clients.name,
    parent: { table: clients, on: eq(clients.id, projects.clientId) }
  },
  {
    kind: "task",
    window: "trash",
    table: tasks,
    id: tasks.id,
    deletedAt: tasks.deletedAt,
    title: tasks.title,
    context: projects.name,
    parent: { table: projects, on: eq(projects.id, tasks.projectId) }
  },
  {
    kind: "proposal",
    window: "trash",
    table: proposals,
    id: proposals.id,
    deletedAt: proposals.deletedAt,
    title: proposals.number,
    context: clients.name,
    parent: { table: clients, on: eq(clients.id, proposals.clientId) }
  },
  {
    kind: "contract",
    window: "financial",
    table: contracts,
    id: contracts.id,
    deletedAt: contracts.deletedAt,
    title: contracts.number,
    context: clients.name,
    parent: { table: clients, on: eq(clients.id, contracts.clientId) }
  },
  {
    kind: "invoice",
    window: "financial",
    table: invoices,
    id: invoices.id,
    deletedAt: invoices.deletedAt,
    title: invoices.number,
    context: clients.name,
    parent: { table: clients, on: eq(clients.id, invoices.clientId) }
  },
  {
    kind: "creditNote",
    window: "financial",
    table: creditNotes,
    id: creditNotes.id,
    deletedAt: creditNotes.deletedAt,
    title: creditNotes.number,
    context: invoices.number,
    parent: { table: invoices, on: eq(invoices.id, creditNotes.invoiceId) }
  },
  {
    kind: "payment",
    window: "financial",
    table: payments,
    id: payments.id,
    deletedAt: payments.deletedAt,
    title: payments.reference,
    context: invoices.number,
    parent: { table: invoices, on: eq(invoices.id, payments.invoiceId) }
  },
  {
    kind: "recurringInvoice",
    window: "trash",
    table: recurringInvoices,
    id: recurringInvoices.id,
    deletedAt: recurringInvoices.deletedAt,
    title: recurringInvoices.name,
    context: clients.name,
    parent: { table: clients, on: eq(clients.id, recurringInvoices.clientId) }
  },
  {
    kind: "timeEntry",
    window: "trash",
    table: timeEntries,
    id: timeEntries.id,
    deletedAt: timeEntries.deletedAt,
    title: timeEntries.description,
    context: projects.name,
    parent: { table: projects, on: eq(projects.id, timeEntries.projectId) }
  },
  {
    kind: "expense",
    window: "financial",
    table: expenses,
    id: expenses.id,
    deletedAt: expenses.deletedAt,
    title: expenses.description,
    context: projects.name,
    parent: { table: projects, on: eq(projects.id, expenses.projectId) }
  },
  {
    kind: "taxRate",
    window: "trash",
    table: taxRates,
    id: taxRates.id,
    deletedAt: taxRates.deletedAt,
    title: taxRates.name,
    context: sql`null`
  },
  {
    kind: "template",
    window: "trash",
    table: templates,
    id: templates.id,
    deletedAt: templates.deletedAt,
    title: templates.name,
    context: sql`null`
  }
]

export async function getTrashSectionData(input: unknown): Promise<TrashSectionData> {
  const query = parseTrashListQuery(input)
  const sources = query.record
    ? TRASH_SOURCES.filter((source) => source.kind === query.record?.kind)
    : TRASH_SOURCES

  const [instanceSettings, rows, rowCount] = await Promise.all([
    readRetentionSettings(),
    readTrashPage(sources, query),
    countTrashRows(sources, query)
  ])

  const schedules = await resolvePageSchedules(rows, instanceSettings.policy)

  return {
    items: rows.map((row, index) => ({
      kind: row.kind,
      id: row.id,
      title: row.title,
      context: row.context,
      deletedAt: row.deletedAt,
      purge: schedules[index] ?? { status: "windowUnset" }
    })),
    rowCount,
    isNarrowedToRecord: query.record !== null,
    policy: instanceSettings.policy,
    locale: instanceSettings.locale,
    timeZone: instanceSettings.timeZone
  }
}

export async function getRetentionPolicy(): Promise<RetentionPolicy> {
  return (await readRetentionSettings()).policy
}

type TrashRow = {
  kind: TrashEntityKind
  window: RetentionWindow
  id: string
  title: string
  context: string | null
  deletedAt: Date
}

const trashRowSchema = z.object({
  kind: z.enum(TRASH_ENTITY_KINDS),
  id: z.string(),
  title: z.string().nullable(),
  context: z.string().nullable(),
  deletedAt: z.coerce.date()
})

const countRowSchema = z.object({ value: z.coerce.number() })

// One query across all fifteen sources, ordered and paged in SQL: the trash has no ceiling, so
// reading each table whole and sorting in the process would grow with everything ever deleted.
async function readTrashPage(sources: TrashSource[], query: TrashListQuery): Promise<TrashRow[]> {
  if (sources.length === 0) return []

  const union = sql.join(
    sources.map((source) => selectTrashSource(source, query)),
    sql` UNION ALL `
  )

  const result = await database.execute(sql`
    SELECT * FROM (${union}) AS trash
    ORDER BY "deletedAt" DESC, "id"
    LIMIT ${query.perPage} OFFSET ${(query.page - 1) * query.perPage}
  `)

  const windows = new Map(sources.map((source) => [source.kind, source.window]))

  return z
    .array(trashRowSchema)
    .parse([...result])
    .map((row) => ({
      kind: row.kind,
      window: windows.get(row.kind) ?? "trash",
      id: row.id,
      // An untitled row still has to be identifiable, and every title column here is nullable on
      // at least one table (a payment reference, a time entry description).
      title: row.title ?? UNTITLED_RECORD,
      context: row.context,
      deletedAt: row.deletedAt
    }))
}

async function countTrashRows(sources: TrashSource[], query: TrashListQuery): Promise<number> {
  const counts = await Promise.all(
    sources.map(async (source) => {
      const result = await database.execute(
        sql`SELECT count(*) AS "value" FROM ${source.table} WHERE ${trashSourceWhere(source, query)}`
      )

      return z.array(countRowSchema).parse([...result])[0]?.value ?? 0
    })
  )

  return counts.reduce((total, value) => total + value, 0)
}

function selectTrashSource(source: TrashSource, query: TrashListQuery): SQL {
  const join = source.parent ? sql`LEFT JOIN ${source.parent.table} ON ${source.parent.on}` : sql``

  return sql`
    SELECT ${source.kind}::text AS "kind", ${source.id}::text AS "id",
      (${source.title})::text AS "title", (${source.context})::text AS "context",
      ${source.deletedAt} AS "deletedAt"
    FROM ${source.table} ${join}
    WHERE ${trashSourceWhere(source, query)}
  `
}

function trashSourceWhere(source: TrashSource, query: TrashListQuery): SQL | undefined {
  return and(isNotNull(source.deletedAt), query.record ? eq(source.id, query.record.id) : undefined)
}

// The date each row on the page goes, by the rule the purge itself applies. Only contracts and
// clients need more than their own deletion date, and only the ones on this page are read.
async function resolvePageSchedules(
  rows: TrashRow[],
  policy: RetentionPolicy
): Promise<PurgeSchedule[]> {
  const idsOf = (kind: TrashEntityKind) =>
    rows.filter((row) => row.kind === kind).map((row) => row.id)

  const [countersigned, namingDocuments] = await Promise.all([
    readCountersignedContractIds(database, idsOf("contract")),
    readNamingDocuments(database, idsOf("client"))
  ])

  return rows.map((row) =>
    resolvePurgeSchedule(toPurgeSubject(row, countersigned, namingDocuments), policy)
  )
}

function toPurgeSubject(
  row: TrashRow,
  countersigned: ReadonlySet<string>,
  namingDocuments: ReadonlyMap<string, NamingDocument[]>
): PurgeSubject {
  if (row.kind === "contract") {
    return { kind: "contract", deletedAt: row.deletedAt, countersigned: countersigned.has(row.id) }
  }

  if (row.kind === "client") {
    return {
      kind: "client",
      deletedAt: row.deletedAt,
      namingDocuments: namingDocuments.get(row.id) ?? []
    }
  }

  return { kind: "record", window: row.window, deletedAt: row.deletedAt }
}

async function readRetentionSettings(): Promise<{
  policy: RetentionPolicy
  locale: string
  timeZone: string
}> {
  const row = await database.query.settings.findFirst({
    columns: {
      retentionTrashDays: true,
      retentionFinancialDays: true,
      defaultLocale: true,
      defaultTimezone: true
    }
  })

  return {
    policy: {
      trashDays: row?.retentionTrashDays ?? null,
      financialDays: row?.retentionFinancialDays ?? null
    },
    locale: row?.defaultLocale ?? "en",
    timeZone: row?.defaultTimezone ?? "UTC"
  }
}
