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
import { proposals } from "./proposals"
import { templates } from "./templates"
import { uploads } from "./uploads"

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // No `.references(...)`: the link is the composite `fk_contracts_project_client` added in migration
    // `0002_document_parent_agreement.sql`. Its `(project_id, client_id)` reference to
    // `projects (id, client_id)` is what stops this row naming a project and a different client, and
    // its `ON DELETE SET NULL (project_id) ON UPDATE RESTRICT` is not expressible through Drizzle.
    projectId: uuid("project_id"),
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
    // Nullable is the revoked state (ADR-0029): clearing it withdraws the signing link without
    // touching the contract it points at.
    publicToken: text("public_token"),
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
    index("contracts_template_id_idx").on(table.templateId),
    index("contracts_pdf_upload_id_idx").on(table.pdfUploadId),
    index("contracts_status_idx").on(table.status),
    uniqueIndex("contracts_public_token_idx").on(table.publicToken),
    // One live contract per proposal. A conversion is recorded only here, on the produced document
    // — `proposals` carries no `converted_to_contract_id` back-pointer — so this index is what makes
    // "a proposal converts once" structural:
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
      "chk_contracts_project_requires_client",
      sql`${table.projectId} IS NULL OR ${table.clientId} IS NOT NULL`
    ),
    check(
      "chk_contracts_dates",
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveFrom} IS NULL OR ${table.effectiveUntil} >= ${table.effectiveFrom}`
    )
  ]
)
