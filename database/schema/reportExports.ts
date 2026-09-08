import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { users } from "./auth"
import { reportExportStatus } from "./enums"
import { timestamps } from "./helpers"

// One row per requested report PDF, and the same shape `data_exports` uses for the same reason: the
// render runs in the worker (ADR-0022, ADR-0023), so `status` is the only channel the page has to
// learn whether the artifact exists, failed, or is still being produced.
//
// It is deliberately smaller than `data_exports`. There is no `progress`, because a render is one
// step rather than a walk over every table and every stored object, and no `filename`, because the
// name is derived from `report` and `created_at` by `services/reportFilename.ts` at download time.
//
// `report` is `text` rather than a Postgres enum. The report vocabulary is owned by
// `features/reports/schemas.ts`, which validates every value written here, and an enum would put a
// migration in front of adding a report — the rigidity that already left `entity_type` unable to
// name four domain values.
export const reportExports = pgTable("report_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  report: text("report").notNull(),
  // The scoped query the request was made under, re-parsed by the worker rather than trusted: this
  // column is what makes the rendered PDF cover the same population the reader was looking at, and
  // carrying it on the row instead of in the job payload keeps a re-delivered job rendering the
  // same report.
  filters: jsonb("filters").notNull(),
  status: reportExportStatus("status").notNull().default("pending"),
  // A stable reason code from `features/reports/services/reportExportStatus.ts`, never a raw error
  // string: the value reaches the reader's screen through a translation lookup.
  failureReason: text("failure_reason"),
  requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
    onDelete: "set null"
  }),
  storageKey: text("storage_key"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),

  ...timestamps
})
