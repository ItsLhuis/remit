import { eq, exists, inArray, sql } from "drizzle-orm"

import { type database } from "@/database"
import { contracts, contractSignatures, invoices, proposals } from "@/database/schema"

import { DOMAIN_DATA_INVENTORY } from "@/scripts/core/domainData/inventory"

import { type NamingDocument, type RetentionWindow } from "./services"

// What `resolvePurgeSchedule` needs beyond a row's own deletion date, read the same way for the
// purge that acts on it and the trash that dates it. The windows come from the inventory, so a
// document is held to the window the purge will actually apply to it.

type FactsExecutor = Pick<typeof database, "select" | "selectDistinct">

type NamingDocumentRow = {
  id: string
  clientId: string | null
  deletedAt: Date | null
  countersigned: boolean
}

export async function readCountersignedContractIds(
  executor: FactsExecutor,
  contractIds: readonly string[]
): Promise<Set<string>> {
  if (contractIds.length === 0) return new Set()

  const rows = await executor
    .selectDistinct({ id: contractSignatures.contractId })
    .from(contractSignatures)
    .where(inArray(contractSignatures.contractId, [...contractIds]))

  return new Set(rows.map((row) => row.id))
}

// Keyed by client id. `excludeDocumentIds` drops documents a purge plan has already decided to
// remove earlier in the same run: the purge deletes documents before clients, so by the time it
// reaches a client those documents no longer name it.
export async function readNamingDocuments(
  executor: FactsExecutor,
  clientIds: readonly string[],
  excludeDocumentIds: ReadonlySet<string> = new Set()
): Promise<Map<string, NamingDocument[]>> {
  const byClient = new Map<string, NamingDocument[]>()

  if (clientIds.length === 0) return byClient

  const ids = [...clientIds]

  const sources: Array<{ window: RetentionWindow; rows: NamingDocumentRow[] }> = [
    {
      window: retentionWindowOf("invoices"),
      rows: await executor
        .select({
          id: invoices.id,
          clientId: invoices.clientId,
          deletedAt: invoices.deletedAt,
          countersigned: sql<boolean>`false`
        })
        .from(invoices)
        .where(inArray(invoices.clientId, ids))
    },
    {
      window: retentionWindowOf("proposals"),
      rows: await executor
        .select({
          id: proposals.id,
          clientId: proposals.clientId,
          deletedAt: proposals.deletedAt,
          countersigned: sql<boolean>`false`
        })
        .from(proposals)
        .where(inArray(proposals.clientId, ids))
    },
    {
      window: retentionWindowOf("contracts"),
      rows: await executor
        .select({
          id: contracts.id,
          clientId: contracts.clientId,
          deletedAt: contracts.deletedAt,
          countersigned: sql<boolean>`${exists(
            executor
              .select({ one: sql`1` })
              .from(contractSignatures)
              .where(eq(contractSignatures.contractId, contracts.id))
          )}`
        })
        .from(contracts)
        .where(inArray(contracts.clientId, ids))
    }
  ]

  for (const { window, rows } of sources) {
    for (const row of rows) {
      if (!row.clientId || excludeDocumentIds.has(row.id)) continue

      const documents = byClient.get(row.clientId) ?? []

      documents.push({ window, deletedAt: row.deletedAt, countersigned: row.countersigned })
      byClient.set(row.clientId, documents)
    }
  }

  return byClient
}

function retentionWindowOf(table: "invoices" | "proposals" | "contracts"): RetentionWindow {
  const entry = DOMAIN_DATA_INVENTORY.find((candidate) => candidate.table === table)

  return entry?.retention === "financial" ? "financial" : "trash"
}
