import { count, inArray, sql } from "drizzle-orm"
import { type PgTable } from "drizzle-orm/pg-core"

import { DOMAIN_DATA_INVENTORY } from "./inventory"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")
type DeleteDatabase = Pick<Database, "delete" | "execute" | "select">

export type DomainDeleteScope = "reseed" | "reset"

export type DomainDeleteCounts = Record<string, number>

export type DomainDeleteDatabase = DeleteDatabase

type UploadReference = {
  columnName: string
  tableName: string
}

export async function deleteDomainRows(
  database: DeleteDatabase,
  schema: Schema,
  scope: DomainDeleteScope
): Promise<DomainDeleteCounts> {
  const entries = DOMAIN_DATA_INVENTORY.filter((entry) => entry[scope] === "delete")
  const deletesUploads = entries.some((entry) => entry.key === "uploads")
  // Collected before anything is deleted: every reference to `uploads` is `on delete set null`, so
  // the pointers are gone by the time the rows they belonged to are.
  const uploadIds = deletesUploads ? await collectDeletableUploadIds(database) : []

  // contract_signatures is insert-only at the database level: migration
  // `0001_insert_only_guards.sql` puts BEFORE DELETE/TRUNCATE triggers on it that raise. That guard also fires on the cascade from
  // `contracts`, so it has to be lifted for the whole delete sequence, not just the explicit
  // delete of its own rows. Both callers are an explicit operator instruction, and this runs
  // inside their transaction, so a rollback restores the trigger with everything else and no
  // application write path can reach this. `audit_logs` carries the same guard and is never
  // lifted: it is `keep` for both scopes.
  await database.execute(sql`alter table ${schema.contractSignatures} disable trigger user`)

  const counts: DomainDeleteCounts = {}

  for (const entry of entries) {
    if (entry.key === "uploads") {
      counts[entry.table] = uploadIds.length

      if (uploadIds.length > 0) {
        await database.delete(schema.uploads).where(inArray(schema.uploads.id, uploadIds))
      }

      continue
    }

    const table: PgTable = schema[entry.key]

    // Counted rather than read from the driver's row count, so the number is the same shape on
    // every table and is taken inside the caller's transaction, where it cannot drift.
    counts[entry.table] = await countTableRows(database, table)

    await database.delete(table)
  }

  await database.execute(sql`alter table ${schema.contractSignatures} enable trigger user`)

  return counts
}

export async function countTableRows(database: DeleteDatabase, table: PgTable): Promise<number> {
  const [row] = await database.select({ value: count() }).from(table)

  return row?.value ?? 0
}

// Read from the FK catalogue rather than from a hand-written list of columns, so an upload
// reference added to a future table is picked up without editing this file. Tables the inventory
// keeps are excluded, which is what protects `settings.business_logo_upload_id`; template block
// images are protected by carrying no foreign key at all.
export async function collectDeletableUploadIds(database: DeleteDatabase): Promise<string[]> {
  const keptTables = new Set<string>(
    DOMAIN_DATA_INVENTORY.filter((entry) => entry.reset === "keep").map((entry) => entry.table)
  )

  const referenceRows = await database.execute(sql`
    SELECT tc.table_name AS "tableName", kcu.column_name AS "columnName"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
      AND kcu.constraint_schema = tc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'uploads'
    ORDER BY tc.table_name, kcu.column_name
  `)

  const references = Array.from(referenceRows as Iterable<UploadReference>).filter(
    (reference) => !keptTables.has(reference.tableName)
  )

  const uploadIds = new Set<string>()

  for (const reference of references) {
    const rows = await database.execute(sql`
      SELECT DISTINCT ${sql.identifier(reference.columnName)} AS "uploadId"
      FROM ${sql.identifier(reference.tableName)}
      WHERE ${sql.identifier(reference.columnName)} IS NOT NULL
    `)

    for (const row of Array.from(rows as Iterable<{ uploadId: string }>)) {
      uploadIds.add(row.uploadId)
    }
  }

  return Array.from(uploadIds)
}
