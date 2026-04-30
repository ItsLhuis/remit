import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { relations } from "drizzle-orm"

import { memberRole } from "./enums"
import { users } from "./auth"

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    event: text("event").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: memberRole("actor_role"),
    targetEntityType: text("target_entity_type"),
    targetEntityId: uuid("target_entity_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("audit_logs_event_created_at_idx").on(table.event, table.createdAt.desc()),
    index("audit_logs_actor_idx").on(table.actorUserId),
    index("audit_logs_target_idx").on(table.targetEntityType, table.targetEntityId)
  ]
)

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actorUser: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id]
  })
}))
