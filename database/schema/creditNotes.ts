import { sql } from "drizzle-orm"
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

import { softDelete, timestamps } from "./helpers"
import { invoices } from "./invoices"
import { uploads } from "./uploads"

export const creditNotes = pgTable(
  "credit_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    // The rendered PDF, and the snapshot of what was sent. Written once by the `credit_note.pdf.render` job and never
    // regenerated: re-rendering later would silently restyle a document the client already holds if
    // the template were edited afterwards, so the stored object *is* the record. See
    // `database/schema/invoices.ts` for the full reasoning behind this column.
    pdfUploadId: uuid("pdf_upload_id").references(() => uploads.id, { onDelete: "set null" }),
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
    index("credit_notes_pdf_upload_id_idx").on(table.pdfUploadId),
    uniqueIndex("credit_notes_number_idx").on(table.number),
    check(
      "chk_credit_notes_totals",
      sql`${table.subtotalCents} >= 0 AND ${table.taxAmountCents} >= 0 AND ${table.totalCents} >= 0`
    )
  ]
)
