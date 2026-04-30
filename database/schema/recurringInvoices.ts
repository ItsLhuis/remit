import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
  varchar
} from "drizzle-orm/pg-core"

import { sql } from "drizzle-orm"

import { recurringCadence, recurringInvoiceStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { clients } from "./clients"
import { projects } from "./projects"
import { templates } from "./templates"

export const recurringInvoices = pgTable(
  "recurring_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: recurringInvoiceStatus("status").notNull().default("active"),
    cadence: recurringCadence("cadence").notNull(),
    cadenceDay: integer("cadence_day"),
    nextRunAt: date("next_run_at", { mode: "date" }).notNull(),
    lastRunAt: date("last_run_at", { mode: "date" }),
    endAfterCount: integer("end_after_count"),
    endByDate: date("end_by_date", { mode: "date" }),
    occurrencesGenerated: integer("occurrences_generated").notNull().default(0),
    autoSend: boolean("auto_send").notNull().default(false),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    lineItemsBlueprint: jsonb("line_items_blueprint")
      .notNull()
      .default(sql`'[]'::jsonb`),
    includedHours: integer("included_hours"),
    overageRateCents: bigint("overage_rate_cents", { mode: "number" }),
    notes: text("notes"),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("recurring_invoices_client_id_idx").on(table.clientId),
    index("recurring_invoices_status_idx").on(table.status),
    index("recurring_invoices_next_run_at_idx")
      .on(table.nextRunAt)
      .where(sql`${table.status} = 'active'`),
    check(
      "chk_recurring_invoices_end_condition",
      sql`${table.endAfterCount} IS NULL OR ${table.endByDate} IS NULL`
    ),
    check(
      "chk_recurring_invoices_retainer",
      sql`(${table.includedHours} IS NULL AND ${table.overageRateCents} IS NULL) OR (${table.includedHours} >= 0 AND ${table.overageRateCents} >= 0)`
    )
  ]
)
