import { count, sql } from "drizzle-orm"
import { type PgTable } from "drizzle-orm/pg-core"

import { selectReleasedUploadIds, type ReleasedObject } from "@/lib/storage/objectOwnership"

import { DOMAIN_DATA_INVENTORY } from "./inventory"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")
type DeleteDatabase = Pick<Database, "delete" | "execute" | "insert" | "select">

export type DomainDeleteScope = "reseed" | "reset"

export type DomainDeleteCounts = Record<string, number>

export type DomainDeleteDatabase = DeleteDatabase

export type DomainDeleteResult = {
  counts: DomainDeleteCounts
  storageObjects: number
  // Queued in `object_deletions` by this delete; the caller drains them once its transaction commits.
  deletionIds: string[]
}

// Must run inside the caller's transaction, at repeatable read: the uploads it removes are the ones
// whose last reference went with the deleted rows, the difference between a read of every reference
// before the deletes and one after (`lib/storage/objectOwnership.ts`). An upload a kept table still
// names — the business logo, a template image — is in both reads and stays, and the objects behind
// the removed ones are only queued here, never deleted before the commit (ADR-0049).
export async function deleteDomainRows(
  database: DeleteDatabase,
  schema: Schema,
  scope: DomainDeleteScope
): Promise<DomainDeleteResult> {
  const { readUploadReferences, releaseObjects } = await loadObjectDeletions()

  const entries = DOMAIN_DATA_INVENTORY.filter((entry) => entry[scope] === "delete")
  const releasesUploads = entries.some((entry) => entry.key === "uploads")
  const referencedBefore = releasesUploads ? await readUploadReferences(database) : []

  // contract_signatures is insert-only at the database level: migration
  // `0001_insert_only_guards.sql` puts BEFORE DELETE/TRUNCATE triggers on it that raise. That guard also fires on the cascade from
  // `contracts`, so it has to be lifted for the whole delete sequence, not just the explicit
  // delete of its own rows. Both callers are an explicit operator instruction, and this runs
  // inside their transaction, so a rollback restores the trigger with everything else and no
  // application write path can reach this. `audit_logs` carries the same guard and is never
  // lifted: it is `keep` for both scopes.
  await database.execute(sql`alter table ${schema.contractSignatures} disable trigger user`)

  const counts: DomainDeleteCounts = {}
  const exportArtifacts: ReleasedObject[] = []

  for (const entry of entries) {
    // Removed after every other table, by the release below, rather than at this position.
    if (entry.key === "uploads") {
      counts[entry.table] = 0

      continue
    }

    const table: PgTable = schema[entry.key]

    // Counted rather than read from the driver's row count, so the number is the same shape on
    // every table and is taken inside the caller's transaction, where it cannot drift.
    counts[entry.table] = await countTableRows(database, table)

    if (entry.key === "dataExports" || entry.key === "reportExports") {
      exportArtifacts.push(...(await deleteExportArtifacts(database, schema, entry.key)))

      continue
    }

    await database.delete(table)
  }

  await database.execute(sql`alter table ${schema.contractSignatures} enable trigger user`)

  const release = await releaseObjects(database, { referencedBefore, objects: exportArtifacts })

  if (releasesUploads) counts.uploads = release.uploadRows

  return { counts, storageObjects: release.objects, deletionIds: release.deletionIds }
}

export async function countTableRows(database: DeleteDatabase, table: PgTable): Promise<number> {
  const [row] = await database.select({ value: count() }).from(table)

  return row?.value ?? 0
}

// The uploads a delete in `scope` would release, without deleting anything: every reference, less
// the references held by the tables the scope empties. `resetData/plan.ts` previews with it.
export async function countReleasableUploads(
  database: DeleteDatabase,
  scope: DomainDeleteScope
): Promise<number> {
  const deletedTables = new Set<string>(
    DOMAIN_DATA_INVENTORY.filter((entry) => entry[scope] === "delete").map((entry) => entry.table)
  )

  const { readUploadReferences } = await loadObjectDeletions()

  const referencedNow = await readUploadReferences(database)
  const referencedAfter = await readUploadReferences(database, { excludeTables: deletedTables })

  return selectReleasedUploadIds(referencedNow, referencedAfter).length
}

async function deleteExportArtifacts(
  database: DeleteDatabase,
  schema: Schema,
  key: "dataExports" | "reportExports"
): Promise<ReleasedObject[]> {
  const table = schema[key]
  const rows = await database.delete(table).returning({ storageKey: table.storageKey })

  return rows.flatMap(({ storageKey }) =>
    storageKey ? [{ bucket: "exports" as const, key: storageKey }] : []
  )
}

// Loaded at call time rather than imported: the module reaches `@/database`, which validates the
// environment as it loads, and the CLI commands that import this file load their environment
// first (`scripts/core/cli/bootstrap.ts`) — the reason `runBackup` loads `@/lib/storage/s3` the same
// way.
export async function loadObjectDeletions(): Promise<
  typeof import("@/lib/storage/objectDeletions")
> {
  return import("@/lib/storage/objectDeletions")
}
