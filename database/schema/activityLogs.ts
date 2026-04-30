import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { entityType } from "./enums"

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    messageKey: text("message_key").notNull(),
    messageArgs: jsonb("message_args"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("activity_logs_created_at_idx").on(table.createdAt.desc()),
    index("activity_logs_entity_idx").on(table.entityType, table.entityId),
    index("activity_logs_unread_idx")
      .on(table.id)
      .where(sql`${table.readAt} IS NULL`)
  ]
)

export const activityLogsRelations = relations(activityLogs, () => ({}))
