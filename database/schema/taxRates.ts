import { boolean, check, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { softDelete, timestamps } from "./helpers"
import { lineItems } from "./lineItems"

export const taxRates = pgTable(
  "tax_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    uniqueIndex("uq_tax_rates_default")
      .on(table.isDefault)
      .where(sql`${table.isDefault} = true AND ${table.deletedAt} IS NULL`),
    check("chk_tax_rates_percentage", sql`${table.percentage} >= 0 AND ${table.percentage} <= 100`)
  ]
)

export const taxRatesRelations = relations(taxRates, ({ many }) => ({
  lineItems: many(lineItems)
}))
