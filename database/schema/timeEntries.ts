import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core"

import { users } from "./auth"
import { timeEntrySource } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { invoices } from "./invoices"
import { projects } from "./projects"
import { tasks } from "./tasks"

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
    // Two rate columns, not one. The override is what the user typed on this entry and is the top
    // rung of the precedence ladder; the snapshot is what that ladder resolved to at log time and is
    // frozen afterwards. Collapsing them would make a later project-rate change indistinguishable
    // from a deliberate per-entry rate on re-resolution.
    hourlyRateOverrideCents: bigint("hourly_rate_override_cents", { mode: "number" }),
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
    index("time_entries_invoiced_in_id_idx").on(table.invoicedInId),
    index("time_entries_unbilled_idx")
      .on(table.projectId)
      .where(sql`${table.invoicedInId} IS NULL AND ${table.billable} = true`),
    // The structural form of the "one running timer per user" rule. The application guard in
    // features/timeTracking/mutations.ts (`startTimer`) is what produces the friendly error; this
    // index is what makes the rule hold when two start requests race, since both would read "no
    // running timer" before either inserts.
    uniqueIndex("time_entries_running_timer_idx")
      .on(table.userId)
      .where(sql`${table.endedAt} IS NULL AND ${table.deletedAt} IS NULL`),
    check(
      "chk_time_entries_duration",
      sql`${table.durationSeconds} IS NULL OR ${table.durationSeconds} >= 0`
    ),
    check(
      "chk_time_entries_ended",
      sql`(${table.endedAt} IS NULL AND ${table.durationSeconds} IS NULL) OR (${table.endedAt} IS NOT NULL AND ${table.durationSeconds} IS NOT NULL AND ${table.endedAt} >= ${table.startedAt})`
    ),
    check("chk_time_entries_rate", sql`${table.hourlyRateSnapshotCents} >= 0`),
    check(
      "chk_time_entries_rate_override",
      sql`${table.hourlyRateOverrideCents} IS NULL OR ${table.hourlyRateOverrideCents} >= 0`
    )
  ]
)
