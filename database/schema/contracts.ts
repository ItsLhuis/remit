import {
  type AnyPgColumn,
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

import { sql } from "drizzle-orm"

import { contractStatus } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { clients } from "./clients"
import { projects } from "./projects"
import { proposals } from "./proposals"
import { templates } from "./templates"

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    proposalId: uuid("proposal_id").references((): AnyPgColumn => proposals.id, {
      onDelete: "set null"
    }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
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
