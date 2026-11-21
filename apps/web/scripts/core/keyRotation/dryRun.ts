import * as p from "@clack/prompts"

import chalk from "chalk"

import type postgres from "postgres"

import { decryptValue, encryptValue } from "../encryption/values"
import { formatBytes } from "../utils/format"

import { listArchivePlans } from "./archives"
import { type EncryptedTable } from "./columns"
import { RotationCliError } from "./errors"

type Sql = postgres.Sql

export async function runDryRun(
  client: Sql,
  options: { newKey: Buffer; oldKey: Buffer; remitDataDir: string },
  tables: readonly EncryptedTable[]
): Promise<void> {
  const tableSummaries = await Promise.all(
    tables.map(async (table) => {
      const rowCount = await countRows(client, table.table)
      const verified = await verifyTableRoundTrip(client, table, options)
      return { table: table.table, rowCount, verified }
    })
  )
  const archivePlans = await listArchivePlans(client, options, options.oldKey)

  p.note(
    [
      chalk.bold("Encrypted tables"),
      ...tableSummaries.map(
        (summary) =>
          `  ${summary.table}: ${summary.rowCount} rows; ${summary.verified ? "round-trip verified" : "no encrypted value to sample"}`
      ),
      "",
      chalk.bold("Backup archives"),
      ...(archivePlans.length === 0
        ? ["  No .remitbak archives found."]
        : archivePlans.map((archive) => {
            const descriptor =
              archive.destination === "local"
                ? archive.path
                : `remit://${archive.destination}/${archive.key}`

            return `  ${descriptor} (${formatBytes(archive.size)})`
          }))
    ].join("\n"),
    "Dry run"
  )

  p.outro("Dry run complete. No backup, audit entry, database update, or archive rewrite was made.")
}

async function verifyTableRoundTrip(
  client: Sql,
  table: EncryptedTable,
  options: { newKey: Buffer; oldKey: Buffer }
): Promise<boolean> {
  for (const column of table.columns) {
    const rows = await client<Array<Record<string, unknown>>>`
      SELECT ${client(column)}
      FROM ${client(table.table)}
      WHERE ${client(column)} IS NOT NULL
      LIMIT 1
    `
    const row = rows[0]
    const value = row ? row[column] : null
    if (typeof value !== "string" || !value) continue

    const plaintext = decryptValue(value, options.oldKey)
    const reencrypted = encryptValue(plaintext, options.newKey)

    if (decryptValue(reencrypted, options.newKey) !== plaintext) {
      throw new RotationCliError(
        `Round-trip verification failed for ${table.table}.${column}; rotation was not started.`
      )
    }

    return true
  }

  return false
}

async function countRows(client: Sql, table: string): Promise<number> {
  const [row] = await client<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM ${client(table)}
  `

  return row?.count ?? 0
}
