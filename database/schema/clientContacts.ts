import { sql } from "drizzle-orm"
import { boolean, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { clients } from "./clients"
import { softDelete, timestamps } from "./helpers"

// A satellite of `clients`, never a navigable entity of its own: nothing else in the schema
// references it, and `clients.email` remains the billing address every send path uses. A company
// has a person who approves, a person who signs, and a person in finance who pays; this table is
// where the other two live without displacing the one the documents are addressed to.
export const clientContacts = pgTable(
  "client_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // NOT NULL like `clients.email` and unlike `phone`: a contact exists to be written to, so a row
    // with no address records nothing the client record does not already say.
    email: text("email").notNull(),
    phone: text("phone"),
    role: text("role"),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("client_contacts_client_id_idx").on(table.clientId),
    index("client_contacts_email_idx").on(table.email),
    // The structural form of "at most one primary contact per client", in the same shape as
    // `time_entries_running_timer_idx`. Partial so that soft-deleting a primary contact frees the
    // slot for its replacement.
    uniqueIndex("uq_client_contacts_primary")
      .on(table.clientId)
      .where(sql`${table.isPrimary} = true AND ${table.deletedAt} IS NULL`)
  ]
)
