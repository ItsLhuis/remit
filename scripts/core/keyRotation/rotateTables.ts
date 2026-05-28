import * as p from "@clack/prompts"

import type postgres from "postgres"

import { decryptValue, encryptValue } from "../encryption/values"

import { writeRotationAudit } from "./audit"
import type { EncryptedTable } from "./columns"
import { RotationCliError } from "./errors"
import { readNullableString } from "./verifyOldKey"

type Sql = postgres.Sql

export type TableRotationResult = {
  encryptedValuesRotated: number
  rowsScanned: number
}

type RawEncryptedRow = {
  id: string
  values: Record<string, string | null>
}

export async function rotateEncryptedTables(
  client: Sql,
  tables: readonly EncryptedTable[],
  options: {
    completedTables: Set<string>
    newKey: Buffer
    oldKey: Buffer
    operationId: string
  }
): Promise<Array<TableRotationResult & { table: string }>> {
  const results: Array<TableRotationResult & { table: string }> = []

  for (const table of tables) {
    if (options.completedTables.has(table.table)) {
      results.push({ table: table.table, encryptedValuesRotated: 0, rowsScanned: 0 })
      continue
    }

    const spinner = p.spinner()
    spinner.start(`Rotating ${table.table}...`)

    try {
      const result = await client.begin(async (tx) => {
        const txClient = tx as unknown as Sql
        const rotation = await rotateEncryptedTable(txClient, table, options)
        await writeRotationAudit(txClient, "instance.key_rotation.table_completed", {
          operationId: options.operationId,
          table: table.table,
          columns: table.columns,
          rowsScanned: rotation.rowsScanned,
          encryptedValuesRotated: rotation.encryptedValuesRotated
        })

        return rotation
      })

      spinner.stop(`Rotated ${table.table}.`)
      results.push({ table: table.table, ...result })
    } catch (error) {
      spinner.stop(`Rotation failed for ${table.table}.`)
      throw error
    }
  }

  return results
}

async function rotateEncryptedTable(
  tx: Sql,
  table: EncryptedTable,
  options: { oldKey: Buffer; newKey: Buffer }
): Promise<TableRotationResult> {
  const rows = await tx<Array<Record<string, unknown>>>`
    SELECT ${tx(["id", ...table.columns])}
    FROM ${tx(table.table)}
  `
  let encryptedValuesRotated = 0

  for (const rawRow of rows) {
    const row = parseEncryptedRow(rawRow, table)

    for (const column of table.columns) {
      const value = row.values[column]
      if (value === null) continue

      let plaintext: string

      try {
        plaintext = decryptValue(value, options.oldKey)
      } catch {
        throw new RotationCliError(
          `decrypt failed for ${table.table}.${column} - verify REMIT_ENCRYPTION_KEY matches the database's current key.`
        )
      }

      const rotated = encryptValue(plaintext, options.newKey)

      await tx`
        UPDATE ${tx(table.table)}
        SET ${tx(column)} = ${rotated}
        WHERE ${tx("id")} = ${row.id}
      `

      encryptedValuesRotated += 1
    }
  }

  return {
    encryptedValuesRotated,
    rowsScanned: rows.length
  }
}

function parseEncryptedRow(
  rawRow: Record<string, unknown>,
  table: EncryptedTable
): RawEncryptedRow {
  const id = rawRow.id

  if (typeof id !== "string") {
    throw new RotationCliError(`Refusing rotation: ${table.table}.id was not returned as text.`)
  }

  const values: Record<string, string | null> = {}

  for (const column of table.columns) {
    values[column] = readNullableString(rawRow, column)
  }

  return { id, values }
}
