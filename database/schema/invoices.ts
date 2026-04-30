import {
  type AnyPgColumn,
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

import { relations, sql } from "drizzle-orm"

import { discountType, invoiceStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { clients } from "./clients"
import { lineItems } from "./lineItems"
import { projects } from "./projects"
import { proposals } from "./proposals"
import { recurringInvoices } from "./recurringInvoices"
import { templates } from "./templates"

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    proposalId: uuid("proposal_id").references((): AnyPgColumn => proposals.id, {
      onDelete: "set null"
    }),
    recurringInvoiceId: uuid("recurring_invoice_id").references(() => recurringInvoices.id, {
      onDelete: "set null"
    }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
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
    index("invoices_status_idx").on(table.status),
    index("invoices_due_date_idx").on(table.dueDate),
    uniqueIndex("invoices_public_token_idx").on(table.publicToken),
    check(
      "chk_invoices_parent",
      sql`${table.projectId} IS NOT NULL OR ${table.clientId} IS NOT NULL`
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

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id]
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id]
  }),
  proposal: one(proposals, {
    fields: [invoices.proposalId],
    references: [proposals.id]
  }),
  recurringInvoice: one(recurringInvoices, {
    fields: [invoices.recurringInvoiceId],
    references: [recurringInvoices.id]
  }),
  template: one(templates, {
    fields: [invoices.templateId],
    references: [templates.id]
  }),
  lineItems: many(lineItems)
}))
