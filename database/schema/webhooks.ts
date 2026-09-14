import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"

import { users } from "./auth"
import { webhookDeliveryStatus } from "./enums"
import { encryptedColumn, timestamps } from "./helpers"

// An endpoint an owner registered to receive signed event deliveries (ADR-0039). No `deleted_at`:
// an endpoint is configuration, and deleting one removes its delivery history with it.
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    // Event names from `features/webhooks/schemas.ts`'s `WEBHOOK_EVENTS`, validated there; text
    // rather than an enum so the subscribable set can grow with `lib/events/types.ts` without a
    // type recreate.
    events: text("events").array().notNull(),
    // Encrypted rather than hashed, unlike `api_tokens.token_hash`: every delivery signs with it, so
    // the application has to be able to read it back.
    secret: encryptedColumn("secret").notNull(),
    active: boolean("active").notNull().default(true),
    // `manual` when the owner switched the endpoint off, `consecutive_failures` when the delivery job
    // did after `features/webhooks/services/deliveryPolicy.ts`'s threshold.
    disabledReason: text("disabled_reason"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),

    ...timestamps
  },
  (table) => [
    index("idx_webhook_endpoints_active").on(table.active),
    check("chk_webhook_endpoints_events", sql`cardinality(${table.events}) >= 1`),
    check("chk_webhook_endpoints_consecutive_failures", sql`${table.consecutiveFailures} >= 0`),
    // An inactive endpoint always says why, and an active one never carries a stale reason, so the
    // settings surface can tell "you turned this off" from "we turned this off" from the row alone.
    check(
      "chk_webhook_endpoints_disabled_reason",
      sql`(${table.active} AND ${table.disabledReason} IS NULL) OR (NOT ${table.active} AND ${table.disabledReason} IN ('manual', 'consecutive_failures'))`
    )
  ]
)

// One row per event per endpoint. `attempts` is the per-attempt record — each entry's time, HTTP
// status and outcome code — appended by the delivery job; the response body is never stored,
// because it is whatever an arbitrary server chose to send back.
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // `cascade`: a delivery record says what was sent to an endpoint, and means nothing once the
    // endpoint itself is gone.
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull(),
    status: webhookDeliveryStatus("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    attempts: jsonb("attempts").notNull().default([]),
    lastStatusCode: integer("last_status_code"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),

    ...timestamps
  },
  (table) => [
    index("idx_webhook_deliveries_endpoint_created_at").on(
      table.endpointId,
      table.createdAt.desc()
    ),
    index("idx_webhook_deliveries_created_at").on(table.createdAt.desc()),
    check("chk_webhook_deliveries_attempt_count", sql`${table.attemptCount} >= 0`)
  ]
)
