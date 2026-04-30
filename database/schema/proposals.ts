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

import { discountType, proposalStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { contracts } from "./contracts"
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
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull().default(0),
    discountAmountTotalCents: bigint("discount_amount_total_cents", { mode: "number" })
      .notNull()
      .default(0),
    taxAmountCents: bigint("tax_amount_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    validUntil: date("valid_until", { mode: "date" }),
    notes: text("notes"),
    publicToken: text("public_token").notNull(),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true, mode: "date" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, mode: "date" }),
    viewCount: integer("view_count").notNull().default(0),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
    respondedIp: text("responded_ip"),
    rejectionReason: text("rejection_reason"),
    convertedToInvoiceId: uuid("converted_to_invoice_id").references(
      (): AnyPgColumn => invoices.id,
      {
        onDelete: "set null"
      }
    ),
    convertedToContractId: uuid("converted_to_contract_id").references(
      (): AnyPgColumn => contracts.id,
      {
        onDelete: "set null"
      }
    ),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("proposals_project_id_idx").on(table.projectId),
    index("proposals_template_id_idx").on(table.templateId),
    index("proposals_status_idx").on(table.status),
    uniqueIndex("proposals_public_token_idx").on(table.publicToken),
    check(
      "chk_proposals_discount_percentage",
      sql`${table.discountPercentage} IS NULL OR (${table.discountPercentage} >= 0 AND ${table.discountPercentage} <= 100)`
    ),
    check(
      "chk_proposals_discount_amount",
      sql`${table.discountAmountCents} IS NULL OR ${table.discountAmountCents} >= 0`
    ),
    check(
      "chk_proposals_discount_shape",
      sql`(${table.discountType} IS NULL AND ${table.discountPercentage} IS NULL AND ${table.discountAmountCents} IS NULL) OR (${table.discountType} = 'percentage' AND ${table.discountPercentage} IS NOT NULL AND ${table.discountAmountCents} IS NULL) OR (${table.discountType} = 'fixed' AND ${table.discountAmountCents} IS NOT NULL AND ${table.discountPercentage} IS NULL)`
    ),
    check(
      "chk_proposals_totals",
      sql`${table.subtotalCents} >= 0 AND ${table.discountAmountTotalCents} >= 0 AND ${table.taxAmountCents} >= 0 AND ${table.totalCents} >= 0`
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
  convertedToInvoice: one(invoices, {
    fields: [proposals.convertedToInvoiceId],
    references: [invoices.id]
  }),
  convertedToContract: one(contracts, {
    fields: [proposals.convertedToContractId],
    references: [contracts.id]
  }),
  lineItems: many(lineItems),
  proposalOtps: many(proposalOtps),
  invoices: many(invoices)
}))
