import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"

import { sql } from "drizzle-orm"

import { timeEntrySource } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { invoices } from "./invoices"
import { projects } from "./projects"
import { tasks } from "./tasks"
import { users } from "./auth"

export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    durationSeconds: integer("duration_seconds"),
    billable: boolean("billable").notNull().default(true),
    hourlyRateSnapshotCents: bigint("hourly_rate_snapshot_cents", { mode: "number" }).notNull(),
    description: text("description"),
    source: timeEntrySource("source").notNull().default("timer"),
    invoicedInId: uuid("invoiced_in_id").references(() => invoices.id, { onDelete: "set null" }),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("time_entries_project_id_idx").on(table.projectId),
    index("time_entries_task_id_idx").on(table.taskId),
    index("time_entries_user_id_idx").on(table.userId),
    index("time_entries_started_at_idx").on(table.startedAt.desc()),
    index("time_entries_unbilled_idx")
      .on(table.projectId)
      .where(sql`${table.invoicedInId} IS NULL AND ${table.billable} = true`),
    check(
      "chk_time_entries_duration",
      sql`${table.durationSeconds} IS NULL OR ${table.durationSeconds} >= 0`
    ),
    check(
      "chk_time_entries_ended",
      sql`(${table.endedAt} IS NULL AND ${table.durationSeconds} IS NULL) OR (${table.endedAt} IS NOT NULL AND ${table.durationSeconds} IS NOT NULL AND ${table.endedAt} >= ${table.startedAt})`
    ),
    check("chk_time_entries_rate", sql`${table.hourlyRateSnapshotCents} >= 0`)
  ]
)
