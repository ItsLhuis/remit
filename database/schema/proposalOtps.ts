import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { proposalAction } from "./enums"
import { proposals } from "./proposals"

export const proposalOtps = pgTable(
  "proposal_otps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    action: proposalAction("action").notNull(),
    codeHash: text("code_hash").notNull(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("idx_proposal_otps_proposal_id").on(table.proposalId),
    index("idx_proposal_otps_active")
      .on(table.proposalId)
      .where(sql`${table.usedAt} IS NULL AND ${table.invalidatedAt} IS NULL`),
    check("chk_proposal_otps_attempts", sql`${table.attempts} >= 0 AND ${table.attempts} <= 5`),
    check(
      "chk_proposal_otps_used_invalidated",
      sql`NOT (${table.usedAt} IS NOT NULL AND ${table.invalidatedAt} IS NOT NULL)`
    )
  ]
)

export const proposalOtpsRelations = relations(proposalOtps, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalOtps.proposalId],
    references: [proposals.id]
  })
}))
