import { and, count, desc, eq, inArray, isNull, type SQL } from "drizzle-orm"
import { type PgColumn, type PgTable } from "drizzle-orm/pg-core"

import { database } from "@/database"
import {
  activityLogs,
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
  timeEntries
} from "@/database/schema"

import { isActivityMessageKey } from "./labels"
import {
  activityEntityFilterSchema,
  activityMessageArgsSchema,
  parseActivityListQuery,
  type ActivityEntityType,
  type ActivityListQuery
} from "./schemas"
import { resolveActivityTarget, type ActivityRecordState, type ActivityTarget } from "./services"
import {
  type ActivityEntry,
  type ActivityFeedEntry,
  type ActivityFeedPageData,
  type EntityActivityPanelData
} from "./types"

type ActivityLogRow = typeof activityLogs.$inferSelect

type ActivityDefaults = {
  locale: string
  timeZone: string
}

// How much history a detail page shows beside the record itself. The feed is where the full history
// lives; a timeline in a card is a glance, not a log.
const ENTITY_TIMELINE_LIMIT = 20

type RecordSource = {
  table: PgTable
  id: PgColumn
  deletedAt: PgColumn
}

const PLAIN_SOURCES: Record<
  Exclude<ActivityEntityType, "invoice" | "payment" | "credit_note">,
  RecordSource
> = {
  client: { table: clients, id: clients.id, deletedAt: clients.deletedAt },
  lead: { table: leads, id: leads.id, deletedAt: leads.deletedAt },
  project: { table: projects, id: projects.id, deletedAt: projects.deletedAt },
  proposal: { table: proposals, id: proposals.id, deletedAt: proposals.deletedAt },
  contract: { table: contracts, id: contracts.id, deletedAt: contracts.deletedAt },
  recurring_invoice: {
    table: recurringInvoices,
    id: recurringInvoices.id,
    deletedAt: recurringInvoices.deletedAt
  },
  time_entry: { table: timeEntries, id: timeEntries.id, deletedAt: timeEntries.deletedAt },
  expense: { table: expenses, id: expenses.id, deletedAt: expenses.deletedAt }
}

type StateRow = ActivityRecordState & { id: string }

export async function getActivityFeedPageData(
  input: unknown,
  options: { canOpenTrash: boolean }
): Promise<ActivityFeedPageData> {
  const query = parseActivityListQuery(input)

  const [list, unreadCount, defaults] = await Promise.all([
    listActivity(query),
    getUnreadActivityCount(),
    getActivityDefaults()
  ])

  return {
    entries: await withActivityTargets(list.rows, options),
    rowCount: list.rowCount,
    pageCount: Math.max(1, Math.ceil(list.rowCount / query.perPage)),
    unreadCount,
    query,
    locale: defaults.locale,
    timeZone: defaults.timeZone
  }
}

export async function listActivity(
  query: ActivityListQuery
): Promise<{ rows: ActivityEntry[]; rowCount: number }> {
  const whereClause = getActivityListWhereClause(query)

  const [rows, totalRows] = await Promise.all([
    database
      .select()
      .from(activityLogs)
      .where(whereClause)
      .orderBy(desc(activityLogs.createdAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database.select({ value: count() }).from(activityLogs).where(whereClause)
  ])

  return {
    rows: rows.flatMap((row) => {
      const entry = toActivityEntry(row)

      return entry ? [entry] : []
    }),
    rowCount: totalRows[0]?.value ?? 0
  }
}

// What a detail page needs to render its timeline in one read: the entries plus the locale and time
// zone every timestamp is formatted against. Bundled rather than left to the caller because a page
// that forgot the time zone would silently print the server's, which `money-and-dates.md` forbids.
export async function getEntityActivity(input: unknown): Promise<EntityActivityPanelData> {
  const [entries, defaults] = await Promise.all([listEntityActivity(input), getActivityDefaults()])

  return { entries, locale: defaults.locale, timeZone: defaults.timeZone }
}

export async function listEntityActivity(input: unknown): Promise<ActivityEntry[]> {
  const parsed = activityEntityFilterSchema.safeParse(input)

  if (!parsed.success) return []

  const rows = await database
    .select()
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.entityType, parsed.data.entityType),
        eq(activityLogs.entityId, parsed.data.entityId)
      )
    )
    .orderBy(desc(activityLogs.createdAt))
    .limit(ENTITY_TIMELINE_LIMIT)

  return rows.flatMap((row) => {
    const entry = toActivityEntry(row)

    return entry ? [entry] : []
  })
}

export async function getUnreadActivityCount(): Promise<number> {
  const [row] = await database
    .select({ value: count() })
    .from(activityLogs)
    .where(isNull(activityLogs.readAt))

  return row?.value ?? 0
}

async function getActivityDefaults(): Promise<ActivityDefaults> {
  const row = await database.query.settings.findFirst({
    columns: { defaultLocale: true, defaultTimezone: true }
  })

  return {
    locale: row?.defaultLocale ?? "en",
    timeZone: row?.defaultTimezone ?? "UTC"
  }
}

function getActivityListWhereClause(query: ActivityListQuery): SQL | undefined {
  const conditions: SQL[] = []

  if (query.entityType) conditions.push(eq(activityLogs.entityType, query.entityType))

  if (query.read === "unread") conditions.push(isNull(activityLogs.readAt))

  return and(...conditions)
}

// A row whose `message_key` or `message_args` no longer parses is dropped rather than rendered: the
// key is a reference into `Translations`, and a message retired by a later version would otherwise
// surface as its own raw key in the middle of the feed. Dropping is why `rowCount` — which SQL
// counts — can exceed the number of entries returned; the pager is deliberately built on the count
// the database gives, so paging stays stable rather than shifting as rows are skipped.
function toActivityEntry(row: ActivityLogRow): ActivityEntry | null {
  if (!isActivityMessageKey(row.messageKey)) return null

  const messageArgs = activityMessageArgsSchema.safeParse(row.messageArgs ?? {})

  if (!messageArgs.success) return null

  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    messageKey: row.messageKey,
    messageArgs: messageArgs.data,
    unread: row.readAt === null,
    createdAt: row.createdAt
  }
}

// One read per entity type on the page, never one per row: the feed shows a page at a time, so this
// is bounded by the page size however long the history grows.
async function withActivityTargets(
  entries: ActivityEntry[],
  options: { canOpenTrash: boolean }
): Promise<ActivityFeedEntry[]> {
  const records = await readRecordStates(entries)

  return entries.map((entry) => ({
    ...entry,
    target: toTarget(entry, records, options)
  }))
}

function toTarget(
  entry: ActivityEntry,
  records: Map<string, ActivityRecordState>,
  options: { canOpenTrash: boolean }
): ActivityTarget {
  return resolveActivityTarget(
    entry.entityType,
    entry.entityId,
    records.get(recordKey(entry.entityType, entry.entityId)),
    options
  )
}

async function readRecordStates(
  entries: ActivityEntry[]
): Promise<Map<string, ActivityRecordState>> {
  const idsByType = new Map<ActivityEntityType, string[]>()

  for (const entry of entries) {
    idsByType.set(entry.entityType, [...(idsByType.get(entry.entityType) ?? []), entry.entityId])
  }

  const reads = [...idsByType].map(async ([entityType, ids]) =>
    (await readStates(entityType, ids)).map(
      ({ id, ...state }) => [recordKey(entityType, id), state] as const
    )
  )

  return new Map((await Promise.all(reads)).flat())
}

async function readStates(entityType: ActivityEntityType, ids: string[]): Promise<StateRow[]> {
  switch (entityType) {
    case "invoice":
      return (
        await database
          .select({ id: invoices.id, deletedAt: invoices.deletedAt, projectId: invoices.projectId })
          .from(invoices)
          .where(inArray(invoices.id, ids))
      ).map((row) => ({ ...row, invoiceId: row.id, invoiceProjectId: row.projectId }))
    case "payment":
      return (
        await database
          .select({
            id: payments.id,
            deletedAt: payments.deletedAt,
            invoiceId: payments.invoiceId,
            invoiceProjectId: invoices.projectId
          })
          .from(payments)
          .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
          .where(inArray(payments.id, ids))
      ).map((row) => ({ ...row, projectId: null }))
    case "credit_note":
      return (
        await database
          .select({
            id: creditNotes.id,
            deletedAt: creditNotes.deletedAt,
            invoiceId: creditNotes.invoiceId,
            invoiceProjectId: invoices.projectId
          })
          .from(creditNotes)
          .leftJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
          .where(inArray(creditNotes.id, ids))
      ).map((row) => ({ ...row, projectId: null }))
    case "client":
    case "lead":
    case "project":
    case "proposal":
    case "contract":
    case "recurring_invoice":
    case "time_entry":
    case "expense":
      return readPlainStates(PLAIN_SOURCES[entityType], ids)
  }
}

async function readPlainStates(source: RecordSource, ids: string[]): Promise<StateRow[]> {
  const rows = await database
    .select({ id: source.id, deletedAt: source.deletedAt })
    .from(source.table)
    .where(inArray(source.id, ids))

  // Built from generic columns, so Drizzle types the fields `unknown`; narrowed rather than cast.
  return rows.flatMap((row) =>
    typeof row.id === "string"
      ? [
          {
            id: row.id,
            deletedAt: row.deletedAt instanceof Date ? row.deletedAt : null,
            projectId: null,
            invoiceId: null,
            invoiceProjectId: null
          }
        ]
      : []
  )
}

function recordKey(entityType: ActivityEntityType, id: string): string {
  return `${entityType}:${id}`
}
