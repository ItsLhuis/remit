import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { leadStatus } from "./enums"
import { clients } from "./clients"
import { softDelete, timestamps } from "./helpers"

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    company: text("company"),
    email: text("email").notNull(),
    phone: text("phone"),
    source: text("source"),
    status: leadStatus("status").notNull().default("new"),
    notes: text("notes"),
    convertedAt: timestamp("converted_at", { withTimezone: true, mode: "date" }),
    convertedToClientId: uuid("converted_to_client_id").references(() => clients.id, {
      onDelete: "set null"
    }),
    lostReason: text("lost_reason"),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("leads_email_idx").on(table.email),
    index("leads_status_idx").on(table.status),
    index("leads_created_at_idx").on(table.createdAt.desc())
  ]
)
