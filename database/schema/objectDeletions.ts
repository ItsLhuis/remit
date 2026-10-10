import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core"

import { storageBucketRole } from "./enums"

// The stored objects whose rows are already gone, waiting to be removed from the bucket. An object
// delete cannot join a database transaction, so a purge, an erasure, a reset or an export expiry
// writes one row here in the same transaction as the row deletes and removes the object only after
// the commit (`lib/storage/objectDeletions.ts`). A row here therefore means "the database no longer
// references this object": the state a failed or interrupted delete leaves behind is a row gone with
// its object still present, which the next drain finishes, and never an object gone while a row
// still points at it (ADR-0049).
//
// Only keys an operation explicitly released are ever written, which is what keeps this from being
// the orphan sweep ADR-0028 rejected: nothing lists the bucket or infers that an object is
// unreferenced from the absence of a row.
export const objectDeletions = pgTable(
  "object_deletions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bucket: storageBucketRole("bucket").notNull(),
    key: text("key").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    // Unique so releasing the same object twice — a retried purge, an erasure racing a sweep —
    // queues it once, and the insert resolves the duplicate to the row already queued rather than
    // failing the transaction.
    uniqueIndex("uq_object_deletions_bucket_key").on(table.bucket, table.key),
    index("idx_object_deletions_created_at").on(table.createdAt),
    check("chk_object_deletions_attempts", sql`${table.attempts} >= 0`)
  ]
)
