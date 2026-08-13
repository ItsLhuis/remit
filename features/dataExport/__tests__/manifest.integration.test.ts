import { getTableColumns, getTableName, is, Table } from "drizzle-orm"

import { describe, expect, test } from "vitest"

import * as schema from "@/database/schema"
import { getEncryptedColumns } from "@/database/schema/helpers"

import {
  getExportExcludedTables,
  getExportTableManifest,
  getExportTables
} from "../services/exportManifest"

// Runs in the integration project rather than the unit one only because importing `@/database/schema`
// pulls in `lib/config/env`, which exits the process when the environment is not set. Nothing here
// touches the database.
type SchemaTable = {
  columns: string[]
  name: string
}

function listSchemaTables(): SchemaTable[] {
  return Object.values(schema).flatMap((value) => {
    if (!is(value, Table)) return []

    return [{ name: getTableName(value), columns: Object.keys(getTableColumns(value)) }]
  })
}

function toDatabaseColumnNames(tableName: string, properties: readonly string[]): string[] {
  const table = listSchemaColumns(tableName)

  return properties.flatMap((property) => {
    const column = table[property]

    return column ? [column] : []
  })
}

function listSchemaColumns(tableName: string): Record<string, string> {
  for (const value of Object.values(schema)) {
    if (!is(value, Table) || getTableName(value) !== tableName) continue

    return Object.fromEntries(
      Object.entries(getTableColumns(value)).map(([property, column]) => [property, column.name])
    )
  }

  throw new Error(`Schema has no table named "${tableName}"`)
}

describe("export manifest coverage", () => {
  test("accounts for every table in the schema", () => {
    const exported = new Set(getExportTables("instance").map((manifest) => manifest.table))
    const excluded = new Set(getExportExcludedTables().map((table) => table.table))

    const unaccounted = listSchemaTables()
      .map((table) => table.name)
      .filter((name) => !exported.has(name) && !excluded.has(name))

    expect(unaccounted).toEqual([])
  })

  test("covers every column of every exported table", () => {
    for (const manifest of getExportTables("instance")) {
      const declared = [
        ...manifest.columns,
        ...manifest.excludedColumns.map((column) => column.column)
      ].sort()

      expect(declared, `manifest for ${manifest.table}`).toEqual(
        Object.keys(listSchemaColumns(manifest.table)).sort()
      )
    }
  })

  test("never both includes and excludes the same column", () => {
    for (const manifest of getExportTables("instance")) {
      const included = new Set(manifest.columns)
      const overlap = manifest.excludedColumns.filter((column) => included.has(column.column))

      expect(overlap, `manifest for ${manifest.table}`).toEqual([])
    }
  })

  test("names only tables that exist in the schema", () => {
    const schemaTables = new Set(listSchemaTables().map((table) => table.name))

    for (const manifest of getExportTables("instance")) {
      expect(schemaTables.has(manifest.table), manifest.table).toBe(true)
    }

    for (const excluded of getExportExcludedTables()) {
      expect(schemaTables.has(excluded.table), excluded.table).toBe(true)
    }
  })
})

describe("encrypted column policy", () => {
  // The registry `encryptedColumn()` maintains is the authoritative list of encrypted-at-rest columns,
  // so a new one added anywhere in the schema is checked against the manifest here rather than trusted
  // to a reviewer noticing.
  test("exports no encrypted column except the owner's own client notes", () => {
    const exportedEncrypted = getEncryptedColumns().filter((encrypted) => {
      const manifest = getExportTableManifest(encrypted.table)

      if (!manifest) return false

      return toDatabaseColumnNames(manifest.table, manifest.columns).includes(encrypted.column)
    })

    expect(exportedEncrypted).toEqual([{ table: "clients", column: "notes" }])
  })

  test("marks every excluded encrypted settings column as a secret", () => {
    const manifest = getExportTableManifest("settings")

    if (!manifest) throw new Error("settings manifest is missing")

    const encryptedProperties = new Set(
      getEncryptedColumns()
        .filter((encrypted) => encrypted.table === "settings")
        .map((encrypted) => encrypted.column)
    )

    const encryptedExclusions = manifest.excludedColumns.filter((excluded) =>
      toDatabaseColumnNames("settings", [excluded.column]).some((column) =>
        encryptedProperties.has(column)
      )
    )

    expect(encryptedExclusions.length).toBeGreaterThan(0)
    expect(encryptedExclusions.every((excluded) => excluded.reason === "secret")).toBe(true)
  })
})
