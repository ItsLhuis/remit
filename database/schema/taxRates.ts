import { boolean, check, index, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { user } from "./auth"
import { softDelete, timestamps } from "./helpers"
import { lineItems } from "./lineItems"

export const taxRates = pgTable(
  "tax_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("idx_tax_rates_user_id").on(table.userId),
    index("idx_tax_rates_active")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    check("chk_tax_rates_percentage", sql`${table.percentage} >= 0 AND ${table.percentage} <= 100`)
  ]
)

export const taxRatesRelations = relations(taxRates, ({ one, many }) => ({
  user: one(user, {
    fields: [taxRates.userId],
    references: [user.id]
  }),
  lineItems: many(lineItems)
}))
