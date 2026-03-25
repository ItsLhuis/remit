import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { relations } from "drizzle-orm"

import { user } from "./auth"
import { documentType, emailStatus } from "./enums"
import { templates } from "./templates"

export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    documentType: documentType("document_type").notNull(),
    documentId: uuid("document_id").notNull(),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    recipientEmail: text("recipient_email").notNull(),
    recipientName: text("recipient_name"),
    subject: text("subject").notNull(),
    status: emailStatus("status").notNull().default("pending"),
    pdfAttached: boolean("pdf_attached").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("idx_email_logs_user_id").on(table.userId),
    index("idx_email_logs_document").on(table.documentType, table.documentId),
    index("idx_email_logs_status").on(table.status)
  ]
)

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  user: one(user, {
    fields: [emailLogs.userId],
    references: [user.id]
  }),
  template: one(templates, {
    fields: [emailLogs.templateId],
    references: [templates.id]
  })
}))
