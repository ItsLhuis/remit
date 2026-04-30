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
import { softDelete, timestamps } from "./helpers"
import { creditNotes } from "./creditNotes"
import { expenses } from "./expenses"
import { invoices } from "./invoices"
import { proposals } from "./proposals"
import { taxRates } from "./taxRates"
import { timeEntries } from "./timeEntries"

/**
 * Snapshot fields on line items:
 * - taxPercentageSnapshot
 * - unitPriceCents
 * - discountPercentage
 * - discountAmountCents
 *
 * These values are captured at line-item creation time and preserved as-is, even
 * if referenced entities (for example, a `tax_rates` row) are modified later.
 * This protects invoice immutability after issuance.
 */
export const lineItems = pgTable(
  "line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    creditNoteId: uuid("credit_note_id").references(() => creditNotes.id, { onDelete: "cascade" }),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    unit: text("unit"),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    discountType: discountType("discount_type"),
    discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }),
    discountAmountCents: bigint("discount_amount_cents", { mode: "number" }),
    taxPercentageSnapshot: numeric("tax_percentage_snapshot", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull().default(0),
    taxAmountCents: bigint("tax_amount_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    sourceTimeEntryId: uuid("source_time_entry_id").references(() => timeEntries.id, {
      onDelete: "set null"
    }),
    sourceExpenseId: uuid("source_expense_id").references(() => expenses.id, {
      onDelete: "set null"
    }),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("line_items_proposal_id_idx").on(table.proposalId),
    index("line_items_invoice_id_idx").on(table.invoiceId),
    index("idx_line_items_credit_note_id").on(table.creditNoteId),
    index("line_items_tax_rate_id_idx").on(table.taxRateId),
    index("line_items_source_time_entry_id_idx").on(table.sourceTimeEntryId),
    index("line_items_source_expense_id_idx").on(table.sourceExpenseId),
    uniqueIndex("uq_line_items_proposal_position")
      .on(table.proposalId, table.position)
      .where(sql`${table.proposalId} IS NOT NULL`),
    uniqueIndex("uq_line_items_invoice_position")
      .on(table.invoiceId, table.position)
      .where(sql`${table.invoiceId} IS NOT NULL`),
    uniqueIndex("uq_line_items_credit_note_position")
      .on(table.creditNoteId, table.position)
      .where(sql`${table.creditNoteId} IS NOT NULL`),
    check(
      "chk_line_items_parent",
      sql`(
        (${table.proposalId} IS NOT NULL)::int +
        (${table.invoiceId} IS NOT NULL)::int +
        (${table.creditNoteId} IS NOT NULL)::int
      ) = 1`
    ),
    check(
      "chk_line_items_discount_percentage",
      sql`${table.discountPercentage} IS NULL OR (${table.discountPercentage} >= 0 AND ${table.discountPercentage} <= 100)`
    ),
    check(
      "chk_line_items_discount_amount",
      sql`${table.discountAmountCents} IS NULL OR ${table.discountAmountCents} >= 0`
    ),
    check(
      "chk_line_items_discount_shape",
      sql`(${table.discountType} IS NULL AND ${table.discountPercentage} IS NULL AND ${table.discountAmountCents} IS NULL) OR (${table.discountType} = 'percentage' AND ${table.discountPercentage} IS NOT NULL AND ${table.discountAmountCents} IS NULL) OR (${table.discountType} = 'fixed' AND ${table.discountAmountCents} IS NOT NULL AND ${table.discountPercentage} IS NULL)`
    ),
    check("chk_line_items_quantity", sql`${table.quantity} > 0`),
    check("chk_line_items_unit_price", sql`${table.unitPriceCents} >= 0`),
    check(
      "chk_line_items_tax_percentage",
      sql`${table.taxPercentageSnapshot} >= 0 AND ${table.taxPercentageSnapshot} <= 100`
    ),
    check(
      "chk_line_items_totals",
      sql`${table.subtotalCents} >= 0 AND ${table.taxAmountCents} >= 0 AND ${table.totalCents} >= 0`
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
