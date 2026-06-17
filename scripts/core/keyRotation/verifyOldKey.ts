import * as p from "@clack/prompts"

import type postgres from "postgres"

import { decryptValue } from "../encryption/values"

import type { EncryptedTable } from "./columns"
import { RotationCliError } from "./errors"

type Sql = postgres.Sql

export async function verifyOldKeyMatchesInstance(
  client: Sql,
  tables: readonly EncryptedTable[],
  options: { oldKey: Buffer }
): Promise<void> {
  for (const table of tables) {
    for (const column of table.columns) {
      const rows = await client<Array<Record<string, unknown>>>`
        SELECT ${client(column)}
        FROM ${client(table.table)}
        WHERE ${client(column)} IS NOT NULL
        LIMIT 1
      `
      const value = readNullableString(rows[0], column)
      if (value === null) continue

      try {
        decryptValue(value, options.oldKey)
      } catch {
        throw new RotationCliError(
          `decrypt failed for ${table.table}.${column} - verify REMIT_ENCRYPTION_KEY matches the database's current key.`
        )
      }
      return
    }
  }

  p.note(
    "No existing encrypted column values were found; the old key was verified against the container environment.",
    "Key check"
  )
}

export function readNullableString(
  row: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!row) return null

  return readNullableUnknownString(row[key])
}

export function readNullableUnknownString(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (typeof value !== "string") {
    throw new RotationCliError("Encrypted column query returned a non-string value.")
  }

  return value
}
