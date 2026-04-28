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

import { discountType, proposalStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { invoices } from "./invoices"
import { lineItems } from "./lineItems"
import { projects } from "./projects"
import { proposalOtps } from "./proposalOtps"
import { templates } from "./templates"

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    number: text("number").notNull().unique(),
    status: proposalStatus("status").notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    discountType: discountType("discount_type"),
    discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }),
    discountAmountCents: bigint("discount_amount_cents", { mode: "number" }),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    discountAmount: bigint("discount_amount", { mode: "number" }).notNull().default(0),
    taxAmount: bigint("tax_amount", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    validUntil: date("valid_until", { mode: "date" }),
    notes: text("notes"),
    publicToken: text("public_token").notNull().unique(),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true, mode: "date" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, mode: "date" }),
    viewCount: integer("view_count").notNull().default(0),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
    respondedIp: text("responded_ip"),
    rejectionReason: text("rejection_reason"),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("idx_proposals_project_id").on(table.projectId),
    index("idx_proposals_template_id").on(table.templateId),
    index("idx_proposals_status").on(table.status),
    index("idx_proposals_active")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("idx_proposals_public_token").on(table.publicToken),
    check(
      "proposals_discount_percentage_chk",
      sql`${table.discountPercentage} IS NULL OR (${table.discountPercentage} >= 0 AND ${table.discountPercentage} <= 100)`
    ),
    check(
      "proposals_discount_amount_chk",
      sql`${table.discountAmountCents} IS NULL OR ${table.discountAmountCents} >= 0`
    ),
    check(
      "proposals_discount_shape_chk",
      sql`(${table.discountType} IS NULL AND ${table.discountPercentage} IS NULL AND ${table.discountAmountCents} IS NULL) OR (${table.discountType} = 'percentage' AND ${table.discountPercentage} IS NOT NULL AND ${table.discountAmountCents} IS NULL) OR (${table.discountType} = 'fixed' AND ${table.discountAmountCents} IS NOT NULL AND ${table.discountPercentage} IS NULL)`
    ),
    check(
      "chk_proposals_totals",
      sql`${table.subtotal} >= 0 AND ${table.discountAmount} >= 0 AND ${table.taxAmount} >= 0 AND ${table.total} >= 0`
    ),
    check("chk_proposals_view_count", sql`${table.viewCount} >= 0`),
    check(
      "chk_proposals_response",
      sql`(${table.status} NOT IN ('accepted', 'rejected')) OR (${table.respondedAt} IS NOT NULL AND ${table.respondedIp} IS NOT NULL)`
    )
  ]
)

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  project: one(projects, {
    fields: [proposals.projectId],
    references: [projects.id]
  }),
  template: one(templates, {
    fields: [proposals.templateId],
    references: [templates.id]
  }),
  lineItems: many(lineItems),
  proposalOtps: many(proposalOtps),
  invoices: many(invoices)
}))
