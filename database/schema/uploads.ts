import { sql } from "drizzle-orm"
import { bigint, check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

// Deliberately carries no owner column and no `deletedAt`: an upload is a content-addressed blob
// that several domains point at, and tying it to a user would make an avatar, a template image, and
// a receipt three different kinds of row. Two consequences a caller has to know: any authenticated
// write path can reference any upload row by id, so authorization has to come from the referencing
// record rather than from here (see `features/templates`' `findMissingImageUpload`); and removing a
// row is a hard delete, so every reference to it is `on delete set null`.
export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    path: text("path").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [check("chk_uploads_size_bytes", sql`${table.sizeBytes} > 0`)]
)
