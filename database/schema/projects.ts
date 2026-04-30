import { bigint, check, date, index, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { clients } from "./clients"
import { projectStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { invoices } from "./invoices"
import { proposals } from "./proposals"

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id]
  }),
  proposals: many(proposals),
  invoices: many(invoices)
}))
