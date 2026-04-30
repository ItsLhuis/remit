import { pgEnum } from "drizzle-orm/pg-core"

export const projectStatus = pgEnum("project_status", [
  "active",
  "completed",
  "on_hold",
  "cancelled"
])

export const proposalStatus = pgEnum("proposal_status", ["draft", "sent", "accepted", "rejected"])

export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "paid"])

export const templateType = pgEnum("template_type", [
  "invoice",
  "proposal",
  "contract",
  "credit_note",
  "email_invoice_send",
  "email_proposal_send",
  "email_contract_send",
  "email_payment_receipt",
  "email_overdue_reminder",
  "email_recurring_generated"
])

export const discountType = pgEnum("discount_type", ["percentage", "fixed"])

export const entityType = pgEnum("entity_type", [
  "client",
  "project",
  "proposal",
  "invoice",
  "contract",
  "task",
  "time_entry",
  "expense",
  "payment"
])

export const documentType = pgEnum("document_type", ["proposal", "invoice", "contract"])

export const emailStatus = pgEnum("email_status", ["pending", "sent", "failed"])

export const proposalAction = pgEnum("proposal_action", ["accept", "reject"])

export const memberRole = pgEnum("member_role", ["owner", "accountant", "assistant"])

export const leadStatus = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "won",
  "lost"
])

export const taskStatus = pgEnum("task_status", ["todo", "doing", "done"])

export const taskPriority = pgEnum("task_priority", ["low", "normal", "high", "urgent"])

export const timeEntrySource = pgEnum("time_entry_source", ["timer", "manual"])

export const contractStatus = pgEnum("contract_status", [
  "draft",
  "sent",
  "signed",
  "expired",
  "terminated"
])

export const recurringInvoiceStatus = pgEnum("recurring_invoice_status", [
  "active",
  "paused",
  "completed",
  "cancelled"
])

export const recurringCadence = pgEnum("recurring_cadence", [
  "weekly",
  "monthly",
  "quarterly",
  "yearly"
])

export const paymentMethod = pgEnum("payment_method", ["bank_transfer", "stripe", "cash", "other"])

export const emailProvider = pgEnum("email_provider", ["smtp", "resend"])

export const backupDestination = pgEnum("backup_destination", ["local", "s3", "r2", "b2"])

export const backupCadence = pgEnum("backup_cadence", ["daily", "weekly"])
