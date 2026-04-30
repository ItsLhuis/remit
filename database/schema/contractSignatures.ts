import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { contracts } from "./contracts"
import { uploads } from "./uploads"

export const contractSignatures = pgTable(
  "contract_signatures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    signerName: text("signer_name").notNull(),
    signerEmail: text("signer_email").notNull(),
    consentText: text("consent_text").notNull(),
    ipAddress: text("ip_address").notNull(),
    userAgent: text("user_agent").notNull(),
    signedPdfUploadId: uuid("signed_pdf_upload_id").references(() => uploads.id, {
      onDelete: "set null"
    }),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [index("contract_signatures_contract_id_idx").on(table.contractId)]
)
