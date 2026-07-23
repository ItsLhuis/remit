import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

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
    index("proposal_otps_proposal_id_idx").on(table.proposalId),
    index("proposal_otps_active_idx")
      .on(table.proposalId)
      .where(sql`${table.usedAt} IS NULL AND ${table.invalidatedAt} IS NULL`),
    // The attempt ceiling is a database constraint, not only application logic, so a verification
    // path that forgets to check it fails the write instead of allowing unlimited guesses against
    // a short code. `codeHash` holds a hash for the same reason the ceiling is low: the plaintext
    // code is emailed and never stored, so a database copy yields no usable codes.
    check("chk_proposal_otps_attempts", sql`${table.attempts} >= 0 AND ${table.attempts} <= 5`),
    check(
      "chk_proposal_otps_used_invalidated",
      sql`NOT (${table.usedAt} IS NOT NULL AND ${table.invalidatedAt} IS NOT NULL)`
    )
  ]
)
