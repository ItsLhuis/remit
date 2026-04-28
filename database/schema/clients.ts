import { index, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { softDelete, timestamps } from "./helpers"
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
    notes: text("notes"),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("idx_clients_name").on(table.name),
    index("idx_clients_active")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`)
  ]
)

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects)
}))
