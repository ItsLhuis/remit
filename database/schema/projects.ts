import { bigint, check, date, index, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { user } from "./auth"
import { clients } from "./clients"
import { projectStatus } from "./enums"
import { timestamps } from "./helpers"
import { invoices } from "./invoices"
import { proposals } from "./proposals"

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatus("status").notNull().default("active"),
    budget: bigint("budget", { mode: "number" }),
    startDate: date("start_date", { mode: "date" }),
    endDate: date("end_date", { mode: "date" }),
    ...timestamps
  },
  (table) => [
    index("idx_projects_user_id").on(table.userId),
    index("idx_projects_client_id").on(table.clientId),
    index("idx_projects_status").on(table.status),
    check("chk_projects_budget", sql`${table.budget} IS NULL OR ${table.budget} >= 0`),
    check(
      "chk_projects_dates",
      sql`${table.endDate} IS NULL OR ${table.startDate} IS NULL OR ${table.endDate} >= ${table.startDate}`
    )
  ]
)

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(user, {
    fields: [projects.userId],
    references: [user.id]
  }),
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id]
  }),
  proposals: many(proposals),
  invoices: many(invoices)
}))
