import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core"

import { clients } from "./clients"
import { discountType, invoiceStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { proposals } from "./proposals"
import { recurringInvoices } from "./recurringInvoices"
import { templates } from "./templates"
import { uploads } from "./uploads"

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // No `.references(...)`: the link is the composite `fk_invoices_project_client` added in migration
    // `0002_document_parent_agreement.sql`. Its `(project_id, client_id)` reference to
    // `projects (id, client_id)` is what stops this row naming a project and a different client, and
    // its `ON DELETE SET NULL (project_id) ON UPDATE RESTRICT` is not expressible through Drizzle.
    projectId: uuid("project_id"),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    recurringInvoiceId: uuid("recurring_invoice_id").references(() => recurringInvoices.id, {
      onDelete: "set null"
    }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    // The rendered PDF, and the snapshot of what was sent. It is written once by the
    // `invoice.pdf.render` job and never regenerated: re-rendering from `templateId` would silently
    // restyle an invoice the client already holds if the template were edited afterwards, so the
    // stored object *is* the record. NULL means "not rendered yet, or the render failed" — the two
    // are told apart by the audit log, not by a status column here.
    pdfUploadId: uuid("pdf_upload_id").references(() => uploads.id, { onDelete: "set null" }),
    number: text("number").notNull().unique(),
    status: invoiceStatus("status").notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    exchangeRate: numeric("exchange_rate", { precision: 20, scale: 10 }),
    discountType: discountType("discount_type"),
    discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }),
    discountAmountCents: bigint("discount_amount_cents", { mode: "number" }),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull().default(0),
    discountAmountTotalCents: bigint("discount_amount_total_cents", { mode: "number" })
      .notNull()
      .default(0),
    taxAmountCents: bigint("tax_amount_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    amountPaidCents: bigint("amount_paid_cents", { mode: "number" }).notNull().default(0),
    issueDate: date("issue_date", { mode: "date" }),
    dueDate: date("due_date", { mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    lateFeeCents: bigint("late_fee_cents", { mode: "number" }),
    notes: text("notes"),
    publicToken: text("public_token").notNull(),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true, mode: "date" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, mode: "date" }),
    viewCount: integer("view_count").notNull().default(0),
    lastReminderSentAt: timestamp("last_reminder_sent_at", { withTimezone: true, mode: "date" }),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("invoices_project_id_idx").on(table.projectId),
    index("invoices_client_id_idx").on(table.clientId),
    index("invoices_proposal_id_idx").on(table.proposalId),
    index("invoices_recurring_invoice_id_idx").on(table.recurringInvoiceId),
    index("invoices_template_id_idx").on(table.templateId),
    index("invoices_pdf_upload_id_idx").on(table.pdfUploadId),
    index("invoices_status_idx").on(table.status),
    index("invoices_due_date_idx").on(table.dueDate),
    uniqueIndex("invoices_public_token_idx").on(table.publicToken),
    // Every parent reference above is `set null` so an invoice outlives the records it was raised
    // from, and this check is what stops that from erasing the invoice's last anchor. It also has a
    // side effect worth knowing: because a SET NULL that would violate a check aborts the delete,
    // an invoice's sole remaining parent cannot be hard-deleted at all while the invoice exists.
    check(
      "chk_invoices_parent",
      sql`${table.projectId} IS NOT NULL OR ${table.clientId} IS NOT NULL`
    ),
    check(
      "chk_invoices_project_requires_client",
      sql`${table.projectId} IS NULL OR ${table.clientId} IS NOT NULL`
    ),
    check(
      "chk_invoices_discount_percentage",
      sql`${table.discountPercentage} IS NULL OR (${table.discountPercentage} >= 0 AND ${table.discountPercentage} <= 100)`
    ),
    check(
      "chk_invoices_discount_amount",
      sql`${table.discountAmountCents} IS NULL OR ${table.discountAmountCents} >= 0`
    ),
    check(
      "chk_invoices_discount_shape",
      sql`(${table.discountType} IS NULL AND ${table.discountPercentage} IS NULL AND ${table.discountAmountCents} IS NULL) OR (${table.discountType} = 'percentage' AND ${table.discountPercentage} IS NOT NULL AND ${table.discountAmountCents} IS NULL) OR (${table.discountType} = 'fixed' AND ${table.discountAmountCents} IS NOT NULL AND ${table.discountPercentage} IS NULL)`
    ),
    check(
      "chk_invoices_totals",
      sql`${table.subtotalCents} >= 0 AND ${table.discountAmountTotalCents} >= 0 AND ${table.taxAmountCents} >= 0 AND ${table.totalCents} >= 0`
    ),
    check(
      "chk_invoices_amount_paid",
      sql`${table.amountPaidCents} >= 0 AND ${table.amountPaidCents} <= ${table.totalCents}`
    ),
    check(
      "chk_invoices_dates",
      sql`${table.dueDate} IS NULL OR ${table.issueDate} IS NULL OR ${table.dueDate} >= ${table.issueDate}`
    ),
    check("chk_invoices_view_count", sql`${table.viewCount} >= 0`),
    check("chk_invoices_late_fee", sql`${table.lateFeeCents} IS NULL OR ${table.lateFeeCents} >= 0`)
  ]
)
