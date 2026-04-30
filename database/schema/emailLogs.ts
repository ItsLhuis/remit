import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { relations } from "drizzle-orm"

import { documentType, emailProvider, emailStatus } from "./enums"
import { templates } from "./templates"

export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentType: documentType("document_type"),
    documentId: uuid("document_id"),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    recipientEmail: text("recipient_email").notNull(),
    recipientName: text("recipient_name"),
    subject: text("subject").notNull(),
    status: emailStatus("status").notNull().default("pending"),
    pdfAttached: boolean("pdf_attached").notNull().default(false),
    provider: emailProvider("provider"),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("email_logs_document_idx").on(table.documentType, table.documentId),
    index("email_logs_status_idx").on(table.status),
    index("email_logs_created_at_idx").on(table.createdAt.desc())
  ]
)

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  template: one(templates, {
    fields: [emailLogs.templateId],
    references: [templates.id]
  })
}))
