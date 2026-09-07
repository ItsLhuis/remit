import { desc, eq, isNotNull, sql, type SQL } from "drizzle-orm"
import { type PgColumn, type PgTable } from "drizzle-orm/pg-core"

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

import { type TrashEntityKind } from "./schemas"
import { getPurgeDueAt, type RetentionPolicy, type RetentionWindow } from "./services"
import { type TrashItem, type TrashSectionData } from "./types"

// The trash lists whole records rather than paginating: an instance with more deleted records than
// this has a retention window it should be setting, not a list it should be scrolling.
const TRASH_ITEM_LIMIT = 200

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

export async function getTrashSectionData(): Promise<TrashSectionData> {
  const [instanceSettings, rows] = await Promise.all([
    readRetentionSettings(),
    Promise.all(TRASH_SOURCES.map(readTrashSource))
  ])

  const items = rows
    .flat()
    .toSorted((left, right) => right.deletedAt.getTime() - left.deletedAt.getTime())
    .slice(0, TRASH_ITEM_LIMIT)
    .map(
      (row): TrashItem => ({
        kind: row.kind,
        id: row.id,
        title: row.title,
        context: row.context,
        deletedAt: row.deletedAt,
        purgeDueAt: getPurgeDueAt(row.deletedAt, instanceSettings.policy, row.window)
      })
    )

  return {
    items,
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

async function readTrashSource(source: TrashSource): Promise<TrashRow[]> {
  const columns = {
    id: source.id,
    title: source.title,
    context: source.context,
    deletedAt: source.deletedAt
  }

  const query = database.select(columns).from(source.table)
  const joined = source.parent ? query.leftJoin(source.parent.table, source.parent.on) : query

  const rows = await joined
    .where(isNotNull(source.deletedAt))
    .orderBy(desc(source.deletedAt))
    .limit(TRASH_ITEM_LIMIT)

  return rows.map((row) => ({
    kind: source.kind,
    window: source.window,
    id: toText(row.id) ?? "",
    // An untitled row still has to be identifiable, and every title column here is nullable on at
    // least one table (a payment reference, a time entry description).
    title: toText(row.title) ?? UNTITLED_RECORD,
    context: toText(row.context),
    deletedAt: row.deletedAt instanceof Date ? row.deletedAt : new Date()
  }))
}

// The select is built from `PgColumn`s and `SQL` fragments chosen per source, so Drizzle infers
// `unknown` for every field it returns. Narrowing here rather than casting keeps the read model's
// types honest about that.
function toText(value: unknown): string | null {
  return typeof value === "string" ? value : null
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
