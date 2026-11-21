import { sql } from "drizzle-orm"
import { bigint, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { storageBucket } from "./enums"

// Deliberately carries no owner column and no `deletedAt`: an upload is a content-addressed blob
// that several domains point at, and tying it to a user would make an avatar, a template image, and
// a receipt three different kinds of row. Two consequences a caller has to know: any authenticated
// write path can reference any upload row by id, so authorization has to come from the referencing
// record rather than from here (see `features/templates`' `findMissingImageUpload`); and removing a
// row is a hard delete, so every reference to it is `on delete set null` — except
// `attachments.upload_id`, which is NOT NULL and cascades, because an attachment whose upload is
// gone is not a record that lost its file, it is nothing at all (see
// `database/schema/attachments.ts`).
export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    path: text("path").notNull().unique(),
    // Which store `path` is resolvable in. Defaulted rather than backfilled because every row that
    // existed before generated PDFs is an avatar or a template image in the public bucket, and a
    // reader that ignores this column keeps working for exactly those rows. A `documents` row must
    // never be handed to `resolveStorageUrl`: that helper builds a public URL, which would produce a
    // link the private bucket refuses and mislead the caller into thinking the object is reachable.
    bucket: storageBucket("bucket").notNull().default("public"),
    mimeType: text("mime_type").notNull(),
    // Both measured server-side from the stored object by `lib/storage/verifyUploadedObject.ts`,
    // never taken from the client that uploaded it. The checksum exists for restore verification:
    // `pnpm remit:restore` can tell a truncated or substituted object from an intact one, which the
    // size alone cannot.
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    check("chk_uploads_size_bytes", sql`${table.sizeBytes} > 0`),
    check("chk_uploads_checksum_sha256", sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`),
    index("uploads_checksum_sha256_idx").on(table.checksumSha256)
  ]
)
