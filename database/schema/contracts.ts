import { sql } from "drizzle-orm"
import {
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core"

import { clients } from "./clients"
import { contractStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { projects } from "./projects"
import { proposals } from "./proposals"
import { templates } from "./templates"
import { uploads } from "./uploads"

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    // The rendered PDF, and the snapshot of what was sent. Written once by the `contract.pdf.render` job and never
    // regenerated: re-rendering later would silently restyle a document the client already holds if
    // the template were edited afterwards, so the stored object *is* the record. See
    // `database/schema/invoices.ts` for the full reasoning behind this column.
    pdfUploadId: uuid("pdf_upload_id").references(() => uploads.id, { onDelete: "set null" }),
    number: text("number").notNull().unique(),
    title: text("title").notNull(),
    status: contractStatus("status").notNull().default("draft"),
    blocks: jsonb("blocks")
      .notNull()
      .default(sql`'[]'::jsonb`),
    publicToken: text("public_token").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    effectiveFrom: date("effective_from", { mode: "date" }),
    effectiveUntil: date("effective_until", { mode: "date" }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true, mode: "date" }),
    terminationReason: text("termination_reason"),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("contracts_project_id_idx").on(table.projectId),
    index("contracts_client_id_idx").on(table.clientId),
    index("contracts_proposal_id_idx").on(table.proposalId),
    index("contracts_status_idx").on(table.status),
    uniqueIndex("contracts_public_token_idx").on(table.publicToken),
    // One live contract per proposal. The reverse link `proposals.converted_to_contract_id` was
    // dropped in migration 0009, so this index is what makes "a proposal converts once" structural:
    // two concurrent conversions of the same proposal cannot both commit, the loser's transaction
    // rolls back, and the contract number it claimed is never consumed. Partial so that soft-deleted
    // contracts free their proposal for a fresh conversion.
    uniqueIndex("contracts_proposal_id_unique_idx")
      .on(table.proposalId)
      .where(sql`${table.proposalId} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    check(
      "chk_contracts_parent",
      sql`${table.projectId} IS NOT NULL OR ${table.clientId} IS NOT NULL`
    ),
    check(
      "chk_contracts_dates",
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveFrom} IS NULL OR ${table.effectiveUntil} >= ${table.effectiveFrom}`
    )
  ]
)
