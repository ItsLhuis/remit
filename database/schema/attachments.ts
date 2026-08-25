import { sql } from "drizzle-orm"
import { check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { users } from "./auth"
import { clients } from "./clients"
import { expenses } from "./expenses"
import { timestamps } from "./helpers"
import { invoices } from "./invoices"
import { projects } from "./projects"
import { uploads } from "./uploads"

// The many-files-per-record surface, shaped like `line_items` rather than like a polymorphic
// `(entity_type, entity_id)` pair: one nullable foreign key per attachable entity plus
// `chk_attachments_parent`, so every parent link is a real foreign key Postgres enforces. A
// polymorphic id cannot carry one, and ADR-0026 answered that same question by adding *more*
// database-enforced integrity, not less. The cost is that this table widens when a fifth entity
// becomes attachable — which is the point: joining costs a reviewed migration, because it is also a
// bucket, an authorization, and a limits decision (ADR-0028).
//
// `uploadId` is the one reference to `uploads` that cascades rather than setting null, and the only
// one that is NOT NULL. Every other referencing row — an invoice, a contract, an expense — is a
// record that must outlive its file. An attachment is not: with its upload gone it has no filename,
// no size and no object, so a surviving row would render as a permanently broken entry.
//
// No `softDelete`, deliberately. Removing an attachment deletes both the row and the stored object
// (`features/attachments/mutations.ts`), because a user who removes a file expects it gone rather
// than hidden while the object stays readable to anyone holding its key.
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "cascade" }),
    uploadId: uuid("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    // A caption, not a filename: `uploads.filename` already holds what the user's disk called it,
    // and "Signed NDA 2026" is what the record needs to say. Null means "show the filename".
    title: text("title"),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    ...timestamps
  },
  (table) => [
    index("attachments_client_id_idx").on(table.clientId),
    index("attachments_project_id_idx").on(table.projectId),
    index("attachments_invoice_id_idx").on(table.invoiceId),
    index("attachments_expense_id_idx").on(table.expenseId),
    // Unique, not a plain index: `uploadId` is NOT NULL and cascades, and `removeAttachment` deletes
    // the `uploads` row to remove an attachment. Two attachments sharing one upload would therefore
    // make removing either destroy both. Nothing creates a shared upload today — every add inserts a
    // fresh row — so this is what turns "one upload per attachment" from an accident of the write
    // path into a fact the database keeps, and what makes a future dedup pass fail loudly here
    // instead of silently deleting someone else's file.
    uniqueIndex("uq_attachments_upload_id").on(table.uploadId),
    index("attachments_uploaded_by_user_id_idx").on(table.uploadedByUserId),
    // Exactly one parent, in the same shape as `chk_line_items_parent`. It is what makes "an
    // attachment always belongs to precisely one record the requester can be checked against" a
    // structural fact rather than an application convention, and it is the half of the stage's
    // security property that a forgotten `where` clause cannot undo.
    check(
      "chk_attachments_parent",
      sql`(
        (${table.clientId} IS NOT NULL)::int +
        (${table.projectId} IS NOT NULL)::int +
        (${table.invoiceId} IS NOT NULL)::int +
        (${table.expenseId} IS NOT NULL)::int
      ) = 1`
    ),
    check("chk_attachments_title", sql`${table.title} IS NULL OR length(${table.title}) <= 200`)
  ]
)
