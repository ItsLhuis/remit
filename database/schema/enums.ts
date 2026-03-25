import { pgEnum } from "drizzle-orm/pg-core"

export const projectStatus = pgEnum("project_status", [
  "active",
  "completed",
  "on_hold",
  "cancelled"
])

export const proposalStatus = pgEnum("proposal_status", ["draft", "sent", "accepted", "rejected"])

export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue"])

export const templateType = pgEnum("template_type", [
  "invoice",
  "proposal",
  "email_invoice",
  "email_proposal"
])

export const discountType = pgEnum("discount_type", ["percentage", "fixed"])

export const entityType = pgEnum("entity_type", ["client", "project", "proposal", "invoice"])

export const documentType = pgEnum("document_type", ["proposal", "invoice"])

export const emailStatus = pgEnum("email_status", ["pending", "sent", "failed"])

export const proposalAction = pgEnum("proposal_action", ["accept", "reject"])
