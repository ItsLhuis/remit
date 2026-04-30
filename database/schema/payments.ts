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

import { paymentMethod } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { invoices } from "./invoices"

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    method: paymentMethod("method").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    reference: text("reference"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    notes: text("notes"),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("payments_invoice_id_idx").on(table.invoiceId),
    index("payments_paid_at_idx").on(table.paidAt.desc()),
    uniqueIndex("payments_stripe_payment_intent_idx")
      .on(table.stripePaymentIntentId)
      .where(sql`${table.stripePaymentIntentId} IS NOT NULL`),
    check("chk_payments_amount", sql`${table.amountCents} > 0`)
  ]
)
