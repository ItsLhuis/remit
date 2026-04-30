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

import { sql } from "drizzle-orm"

import { softDelete, timestamps } from "./helpers"
import { clients } from "./clients"
import { invoices } from "./invoices"
import { projects } from "./projects"
import { uploads } from "./uploads"

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
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
    index("expenses_unbilled_rebillable_idx")
      .on(table.projectId)
      .where(sql`${table.invoicedInId} IS NULL AND ${table.rebillable} = true`),
    check("chk_expenses_amount", sql`${table.amountCents} >= 0`),
    check(
      "chk_expenses_markup",
      sql`${table.markupPercentage} IS NULL OR (${table.markupPercentage} >= 0 AND ${table.markupPercentage} <= 1000)`
    )
  ]
)
