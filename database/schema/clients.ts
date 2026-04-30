import { index, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { encryptedColumn, softDelete, timestamps } from "./helpers"
import { projects } from "./projects"

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    website: text("website"),
    taxId: text("tax_id"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country"),
    currency: varchar("currency", { length: 3 }),
    notes: encryptedColumn("notes"),
    portalToken: text("portal_token"),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("clients_name_idx").on(table.name),
    index("clients_email_idx").on(table.email),
    index("clients_active_idx")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("clients_portal_token_idx")
      .on(table.portalToken)
      .where(sql`${table.portalToken} IS NOT NULL`)
  ]
)

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects)
}))
