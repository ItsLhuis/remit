import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  date,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core"

import { clients } from "./clients"
import { projectStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Cascades on purpose, unlike `invoices.clientId` which is `set null`: a project has no
    // meaning without the client it was worked for, whereas an invoice is a financial record that
    // must survive the client being deleted. Every table referencing a client resolves that same
    // question — owned working record, or record that must outlive its subject.
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatus("status").notNull().default("active"),
    currency: varchar("currency", { length: 3 }),
    budgetCents: bigint("budget_cents", { mode: "number" }),
    hourlyRateCents: bigint("hourly_rate_cents", { mode: "number" }),
    startDate: date("start_date", { mode: "date" }),
    endDate: date("end_date", { mode: "date" }),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("projects_client_id_idx").on(table.clientId),
    // Not a domain rule of its own — `id` is already unique. It exists because the composite
    // `fk_<table>_project_client` foreign keys added in migration
    // `0002_document_parent_agreement.sql` reference this pair, and Postgres requires a unique
    // index on a referenced column list.
    uniqueIndex("uq_projects_id_client_id").on(table.id, table.clientId),
    index("projects_status_idx").on(table.status),
    index("projects_active_idx")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    check("chk_projects_budget", sql`${table.budgetCents} IS NULL OR ${table.budgetCents} >= 0`),
    check(
      "chk_projects_hourly_rate",
      sql`${table.hourlyRateCents} IS NULL OR ${table.hourlyRateCents} >= 0`
    ),
    check(
      "chk_projects_dates",
      sql`${table.endDate} IS NULL OR ${table.startDate} IS NULL OR ${table.endDate} >= ${table.startDate}`
    )
  ]
)
