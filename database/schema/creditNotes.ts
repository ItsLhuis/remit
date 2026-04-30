import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core"

import { sql } from "drizzle-orm"

import { softDelete, timestamps } from "./helpers"
import { invoices } from "./invoices"

export const creditNotes = pgTable(
  "credit_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    reason: text("reason"),
    currency: varchar("currency", { length: 3 }).notNull(),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull().default(0),
    taxAmountCents: bigint("tax_amount_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("credit_notes_invoice_id_idx").on(table.invoiceId),
    uniqueIndex("credit_notes_number_idx").on(table.number),
    check(
      "chk_credit_notes_totals",
      sql`${table.subtotalCents} >= 0 AND ${table.taxAmountCents} >= 0 AND ${table.totalCents} >= 0`
    )
  ]
)
