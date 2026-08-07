import { and, count, desc, eq, isNull, type SQL } from "drizzle-orm"

import { database } from "@/database"
import { activityLogs } from "@/database/schema"

import { isActivityMessageKey } from "./labels"
import {
  activityEntityFilterSchema,
  activityMessageArgsSchema,
  parseActivityListQuery,
  type ActivityListQuery
} from "./schemas"
import {
  type ActivityEntry,
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

export async function getActivityFeedPageData(input: unknown): Promise<ActivityFeedPageData> {
  const query = parseActivityListQuery(input)

  const [list, unreadCount, defaults] = await Promise.all([
    listActivity(query),
    getUnreadActivityCount(),
    getActivityDefaults()
  ])

  return {
    entries: list.rows,
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
