import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core"

import { encryptedColumn, softDelete, timestamps } from "./helpers"
import { uploads } from "./uploads"

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    website: text("website"),
    taxId: text("tax_id"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country"),
    currency: varchar("currency", { length: 3 }),
    locale: text("locale"),
    defaultHourlyRateCents: bigint("default_hourly_rate_cents", { mode: "number" }),
    notes: encryptedColumn("notes"),
    // `image`, not `logo`: a Remit client is a company or a person, and half of them have a face
    // rather than a mark. Shaped like `settings.business_logo_upload_id` — an `uploads` reference
    // rather than a URL — so the object is instance-owned and the same delete semantics apply.
    imageUploadId: uuid("image_upload_id").references(() => uploads.id, { onDelete: "set null" }),
    portalToken: text("portal_token"),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("clients_name_idx").on(table.name),
    index("clients_email_idx").on(table.email),
    index("clients_image_upload_id_idx").on(table.imageUploadId),
    index("clients_active_idx")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("clients_portal_token_idx")
      .on(table.portalToken)
      .where(sql`${table.portalToken} IS NOT NULL`),
    // Nullable rather than defaulted: null means "this client has no negotiated rate", which is a
    // different fact from "their rate is 0", and only the first may fall through to the instance
    // default in features/timeTracking/services/resolveHourlyRate.ts. Zero is a rate a freelancer
    // can genuinely agree to, so it must stop the fallthrough.
    check(
      "chk_clients_default_hourly_rate",
      sql`${table.defaultHourlyRateCents} IS NULL OR ${table.defaultHourlyRateCents} >= 0`
    )
  ]
)
