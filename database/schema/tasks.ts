import { bigint, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { sql } from "drizzle-orm"

import { taskPriority, taskStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { projects } from "./projects"

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatus("status").notNull().default("todo"),
    priority: taskPriority("priority").notNull().default("normal"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    position: integer("position").notNull().default(0),
    hourlyRateCents: bigint("hourly_rate_cents", { mode: "number" }),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_status_idx").on(table.status),
    index("tasks_due_at_idx")
      .on(table.dueAt)
      .where(sql`${table.dueAt} IS NOT NULL`)
  ]
)
