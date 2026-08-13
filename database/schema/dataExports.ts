import { sql } from "drizzle-orm"
import { bigint, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { users } from "./auth"
import { clients } from "./clients"
import { dataExportScope, dataExportStatus } from "./enums"
import { timestamps } from "./helpers"

// One row per requested export, and the only durable record that an archive exists: the job that
// assembles it runs in the worker process (ADR-0023) and reports back through `status` and
// `progress`, which is what the `/settings/data` page renders. Deliberately no `deletedAt` — an
// export either has an archive behind it or it does not, and hiding a row would leave the object in
// the exports bucket with nothing pointing at it.
export const dataExports = pgTable(
  "data_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: dataExportScope("scope").notNull(),
    // `set null` rather than `cascade`: the archive outlives the client it covers, which is the whole
    // point of an offboarding export. The audit entry written at request time keeps the client id
    // permanently, so the record of what was exported survives even after this column is cleared.
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    status: dataExportStatus("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    // A stable reason code from `features/dataExport/services/exportFailure.ts`, never a raw error
    // string: this column reaches the owner's screen through a translation lookup, and a driver or
    // provider message could carry connection details.
    failureReason: text("failure_reason"),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    filename: text("filename"),
    storageKey: text("storage_key"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    entryCount: integer("entry_count"),

    ...timestamps
  },
  (table) => [
    index("idx_data_exports_status").on(table.status),
    index("idx_data_exports_created_at").on(table.createdAt),
    index("idx_data_exports_client_id").on(table.clientId),
    check("chk_data_exports_progress", sql`${table.progress} BETWEEN 0 AND 100`),
    check(
      "chk_data_exports_size_bytes",
      sql`${table.sizeBytes} IS NULL OR ${table.sizeBytes} >= 0`
    ),
    // The structural form of the scope rule: an instance export must not name a client, and a client
    // export is meaningless without one at the moment it is created. `clientId` may still go null
    // later through the foreign key above, which is why this only constrains the instance side.
    check(
      "chk_data_exports_scope_client",
      sql`(${table.scope} = 'instance' AND ${table.clientId} IS NULL) OR ${table.scope} = 'client'`
    )
  ]
)
