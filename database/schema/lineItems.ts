import {
  bigint,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { discountType } from "./enums"
import { timestamps } from "./helpers"
import { invoices } from "./invoices"
import { proposals } from "./proposals"
import { taxRates } from "./taxRates"

export const lineItems = pgTable(
  "line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    unit: text("unit"),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitPrice: bigint("unit_price", { mode: "number" }).notNull(),
    discountType: discountType("discount_type"),
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }),
    taxPercentage: numeric("tax_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    taxAmount: bigint("tax_amount", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    ...timestamps
  },
  (table) => [
    index("idx_line_items_proposal_id").on(table.proposalId),
    index("idx_line_items_invoice_id").on(table.invoiceId),
    index("idx_line_items_tax_rate_id").on(table.taxRateId),
    uniqueIndex("uq_line_items_proposal_position")
      .on(table.proposalId, table.position)
      .where(sql`${table.proposalId} IS NOT NULL`),
    uniqueIndex("uq_line_items_invoice_position")
      .on(table.invoiceId, table.position)
      .where(sql`${table.invoiceId} IS NOT NULL`),
    check(
      "chk_line_items_parent",
      sql`(${table.proposalId} IS NOT NULL AND ${table.invoiceId} IS NULL) OR (${table.proposalId} IS NULL AND ${table.invoiceId} IS NOT NULL)`
    ),
    check(
      "chk_line_items_discount",
      sql`(${table.discountType} IS NULL AND ${table.discountValue} IS NULL) OR (${table.discountType} IS NOT NULL AND ${table.discountValue} IS NOT NULL)`
    ),
    check(
      "chk_line_items_discount_value",
      sql`${table.discountValue} IS NULL OR ${table.discountValue} >= 0`
    ),
    check("chk_line_items_quantity", sql`${table.quantity} > 0`),
    check("chk_line_items_unit_price", sql`${table.unitPrice} >= 0`),
    check(
      "chk_line_items_tax_percentage",
      sql`${table.taxPercentage} >= 0 AND ${table.taxPercentage} <= 100`
    ),
    check(
      "chk_line_items_totals",
      sql`${table.subtotal} >= 0 AND ${table.taxAmount} >= 0 AND ${table.total} >= 0`
    )
  ]
)

export const lineItemsRelations = relations(lineItems, ({ one }) => ({
  proposal: one(proposals, {
    fields: [lineItems.proposalId],
    references: [proposals.id]
  }),
  invoice: one(invoices, {
    fields: [lineItems.invoiceId],
    references: [invoices.id]
  }),
  taxRate: one(taxRates, {
    fields: [lineItems.taxRateId],
    references: [taxRates.id]
  })
}))
