import { sql } from "drizzle-orm"
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { users } from "./auth"
import { apiTokenScope } from "./enums"
import { timestamps } from "./helpers"

// One row per token an owner minted for the public API (ADR-0038). The token itself is never
// stored: `token_hash` is the lookup key and the only form of the credential the database holds, so
// a leaked dump or backup hands nobody a working token. Revocation stamps `revoked_at` rather than
// deleting, so the list can still say which token was withdrawn and when, and the audit entries that
// name a token id keep resolving to a name.
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    // The first characters of the random part, shown in the list so an owner can match a token to
    // the place it is configured. Too short to narrow a guess against 256 bits.
    tokenPrefix: text("token_prefix").notNull(),
    scopes: apiTokenScope("scopes").array().notNull(),
    // `set null` rather than `cascade` so the row survives as a record of what was minted; a token
    // with no creator is refused by `features/api/authenticate.ts`, because its permissions are
    // derived from that person on every request.
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),

    ...timestamps
  },
  (table) => [
    uniqueIndex("uq_api_tokens_token_hash").on(table.tokenHash),
    index("idx_api_tokens_created_by_user_id").on(table.createdByUserId),
    check("chk_api_tokens_scopes", sql`cardinality(${table.scopes}) >= 1`)
  ]
)
