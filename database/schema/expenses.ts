import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  uuid,
  varchar
} from "drizzle-orm/pg-core"

import { clients } from "./clients"
import { softDelete, timestamps } from "./helpers"
import { invoices } from "./invoices"
import { uploads } from "./uploads"

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // No `.references(...)`: the link is the composite `fk_expenses_project_client` added in migration
    // `0002_document_parent_agreement.sql`. Its `(project_id, client_id)` reference to
    // `projects (id, client_id)` is what stops this row naming a project and a different client, and
    // its `ON DELETE SET NULL (project_id) ON UPDATE RESTRICT` is not expressible through Drizzle.
    projectId: uuid("project_id"),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    spentAt: date("spent_at", { mode: "date" }).notNull(),
    receiptUploadId: uuid("receipt_upload_id").references(() => uploads.id, {
      onDelete: "set null"
    }),
    rebillable: boolean("rebillable").notNull().default(false),
    markupPercentage: numeric("markup_percentage", { precision: 5, scale: 2 }),
    invoicedInId: uuid("invoiced_in_id").references(() => invoices.id, { onDelete: "set null" }),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("expenses_project_id_idx").on(table.projectId),
    index("expenses_client_id_idx").on(table.clientId),
    index("expenses_spent_at_idx").on(table.spentAt.desc()),
    index("expenses_receipt_upload_id_idx").on(table.receiptUploadId),
    index("expenses_invoiced_in_id_idx").on(table.invoicedInId),
    index("expenses_unbilled_rebillable_idx")
      .on(table.projectId)
      .where(sql`${table.invoicedInId} IS NULL AND ${table.rebillable} = true`),
    // No parent check to pair with this one: both columns null is legitimate here — a bank fee
    // belongs to nobody — which is why `expenses` has no `chk_expenses_parent` sibling to
    // `chk_invoices_parent`. What it does share is the agreement rule: naming a project without its
    // client is what would put one expense on two ledgers.
    check(
      "chk_expenses_project_requires_client",
      sql`${table.projectId} IS NULL OR ${table.clientId} IS NOT NULL`
    ),
    check("chk_expenses_amount", sql`${table.amountCents} >= 0`),
    check(
      "chk_expenses_markup",
      sql`${table.markupPercentage} IS NULL OR (${table.markupPercentage} >= 0 AND ${table.markupPercentage} <= 1000)`
    )
  ]
)
