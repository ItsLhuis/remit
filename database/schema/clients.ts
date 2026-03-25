import { index, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { relations } from "drizzle-orm"

import { user } from "./auth"
import { timestamps } from "./helpers"
import { projects } from "./projects"

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
    ...timestamps
  },
  (table) => [
    index("idx_clients_user_id").on(table.userId),
    index("idx_clients_name").on(table.name)
  ]
)

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(user, {
    fields: [clients.userId],
    references: [user.id]
  }),
  projects: many(projects)
}))
