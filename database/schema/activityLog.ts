import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { entityType } from "./enums"

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    metadata: jsonb("metadata"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("idx_activity_log_created_at").on(table.createdAt.desc()),
    index("idx_activity_log_entity").on(table.entityType, table.entityId),
    index("idx_activity_log_unread")
      .on(table.id)
      .where(sql`${table.readAt} IS NULL`)
  ]
)

export const activityLogRelations = relations(activityLog, () => ({}))
