import {
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
import { timestamps } from "./helpers"
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
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }),
    subtotal: integer("subtotal").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    total: integer("total").notNull().default(0),
    issueDate: date("issue_date", { mode: "date" }),
    dueDate: date("due_date", { mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    publicToken: text("public_token").notNull().unique(),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true, mode: "date" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, mode: "date" }),
    viewCount: integer("view_count").notNull().default(0),
    ...timestamps
  },
  (table) => [
    index("idx_invoices_user_id").on(table.userId),
    index("idx_invoices_project_id").on(table.projectId),
    index("idx_invoices_proposal_id").on(table.proposalId),
    index("idx_invoices_template_id").on(table.templateId),
    index("idx_invoices_status").on(table.status),
    index("idx_invoices_due_date").on(table.dueDate),
    uniqueIndex("idx_invoices_public_token").on(table.publicToken),
    check(
      "chk_invoices_discount",
      sql`(${table.discountType} IS NULL AND ${table.discountValue} IS NULL) OR (${table.discountType} IS NOT NULL AND ${table.discountValue} IS NOT NULL)`
    ),
    check(
      "chk_invoices_discount_value",
      sql`${table.discountValue} IS NULL OR ${table.discountValue} >= 0`
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
