import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { user } from "./auth"

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    path: text("path").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("idx_uploads_user_id").on(table.userId),
    check("chk_uploads_size_bytes", sql`${table.sizeBytes} > 0`)
  ]
)

export const uploadsRelations = relations(uploads, ({ one }) => ({
  user: one(user, {
    fields: [uploads.userId],
    references: [user.id]
  })
}))
