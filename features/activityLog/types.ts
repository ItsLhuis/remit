import { type Translations } from "@/lib/i18n"

import { type activityLogs } from "@/database/schema"

import { type ActivityListQuery, type ActivityMessageArgs } from "./schemas"

type ActivityLogRow = typeof activityLogs.$inferSelect

// Derived from `Translations` rather than declared as a list, so a `message_key` that is not a real
// translation key cannot be constructed at all: events.ts types every key it writes as this, and
// queries.ts narrows the stored text back to it before the feed hands it to `t()`.
export type ActivityMessageKey = `activity.messages.${keyof Translations["activity"]["messages"]}`

export type ActivityEntityTypeLabelKey =
  `activity.entityTypes.${keyof Translations["activity"]["entityTypes"]}`

export type ActivityEntry = {
  id: string
  // Typed from the column rather than from schemas.ts's `ACTIVITY_ENTITY_TYPES` tuple. That tuple is
  // a hand restatement of the database enum, and this is what makes a drift between the two fail the
  // build: labels.ts keys its presentation maps on the tuple, so a value the enum gains and the
  // tuple lacks stops type-checking here rather than reaching the feed as an unlabelled row.
  entityType: ActivityLogRow["entityType"]
  entityId: string
  action: string
  messageKey: ActivityMessageKey
  messageArgs: ActivityMessageArgs
  unread: boolean
  createdAt: Date
}

export type EntityActivityPanelData = {
  entries: ActivityEntry[]
  locale: string
  timeZone: string
}

export type ActivityFeedPageData = {
  entries: ActivityEntry[]
  rowCount: number
  pageCount: number
  unreadCount: number
  query: ActivityListQuery
  locale: string
  timeZone: string
}
