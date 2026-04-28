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

import { relations, sql } from "drizzle-orm"

import { user } from "./auth"
import { discountType, invoiceStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { lineItems } from "./lineItems"
import { projects } from "./projects"
import { proposals } from "./proposals"
import { templates } from "./templates"

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    number: text("number").notNull().unique(),
    status: invoiceStatus("status").notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    discountType: discountType("discount_type"),
    discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }),
    discountAmountCents: bigint("discount_amount_cents", { mode: "number" }),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    discountAmount: bigint("discount_amount", { mode: "number" }).notNull().default(0),
    taxAmount: bigint("tax_amount", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    issueDate: date("issue_date", { mode: "date" }),
    dueDate: date("due_date", { mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    publicToken: text("public_token").notNull().unique(),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true, mode: "date" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, mode: "date" }),
    viewCount: integer("view_count").notNull().default(0),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("idx_invoices_user_id").on(table.userId),
    index("idx_invoices_project_id").on(table.projectId),
    index("idx_invoices_proposal_id").on(table.proposalId),
    index("idx_invoices_template_id").on(table.templateId),
    index("idx_invoices_status").on(table.status),
    index("idx_invoices_due_date").on(table.dueDate),
    index("idx_invoices_active")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("idx_invoices_public_token").on(table.publicToken),
    check(
      "invoices_discount_percentage_chk",
      sql`${table.discountPercentage} IS NULL OR (${table.discountPercentage} >= 0 AND ${table.discountPercentage} <= 100)`
    ),
    check(
      "invoices_discount_amount_chk",
      sql`${table.discountAmountCents} IS NULL OR ${table.discountAmountCents} >= 0`
    ),
    check(
      "invoices_discount_shape_chk",
      sql`(${table.discountType} IS NULL AND ${table.discountPercentage} IS NULL AND ${table.discountAmountCents} IS NULL) OR (${table.discountType} = 'percentage' AND ${table.discountPercentage} IS NOT NULL AND ${table.discountAmountCents} IS NULL) OR (${table.discountType} = 'fixed' AND ${table.discountAmountCents} IS NOT NULL AND ${table.discountPercentage} IS NULL)`
    ),
    check(
      "chk_invoices_totals",
      sql`${table.subtotal} >= 0 AND ${table.discountAmount} >= 0 AND ${table.taxAmount} >= 0 AND ${table.total} >= 0`
    ),
    check(
      "chk_invoices_dates",
      sql`${table.dueDate} IS NULL OR ${table.issueDate} IS NULL OR ${table.dueDate} >= ${table.issueDate}`
    ),
    check("chk_invoices_view_count", sql`${table.viewCount} >= 0`)
  ]
)

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(user, {
    fields: [invoices.userId],
    references: [user.id]
  }),
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id]
  }),
  proposal: one(proposals, {
    fields: [invoices.proposalId],
    references: [proposals.id]
  }),
  template: one(templates, {
    fields: [invoices.templateId],
    references: [templates.id]
  }),
  lineItems: many(lineItems)
}))
