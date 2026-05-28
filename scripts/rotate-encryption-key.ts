import * as p from "@clack/prompts"

import { loadCliEnvironment } from "./core/cli/bootstrap"

import { isDirectRun } from "./core/cli/isDirectRun"

import { getRotateHelpText, parseRotateArgs } from "./core/keyRotation/args"
import { releaseRotationLock } from "./core/keyRotation/lock"
import { readRotationKeys } from "./core/keyRotation/readKeys"
import {
  formatRotationError,
  runKeyRotation,
  writeAbortAuditIfPossible
} from "./core/keyRotation/runRotation"

export { runKeyRotation }

export type { RotationRuntimeOptions } from "./core/keyRotation/runRotation"

import type postgres from "postgres"

type ReservedSql = postgres.ReservedSql
type DatabaseClient = typeof import("@/database").client

type RotationState = {
  client: DatabaseClient | null
  lock: ReservedSql | null
  operationId: string | null
}

async function main(): Promise<void> {
  loadCliEnvironment()

  const parsed = parseRotateArgs(process.argv.slice(2))

  if ("error" in parsed) {
    console.error(parsed.error)
    console.log("")
    console.log(getRotateHelpText())
    process.exit(1)
  }

  if (parsed.data.help) {
    console.log(getRotateHelpText())
    process.exit(0)
  }

  p.intro("Remit encryption key rotation")

  const state: RotationState = {
    client: null,
    lock: null,
    operationId: null
  }

  try {
    const keys = await readRotationKeys()

    const [{ database, client }, schema, { env }] = await Promise.all([
      import("@/database"),
      import("@/database/schema"),
      import("@/lib/config/env")
    ])

    state.client = client

    await runKeyRotation(database, client, schema, {
      ...parsed.data,
      ...keys,
      currentEnvKey: Buffer.from(env.REMIT_ENCRYPTION_KEY, "base64"),
      databaseUrl: env.DATABASE_URL,
      remitDataDir: env.REMIT_DATA_DIR
    })

    process.exit(0)
  } catch (error) {
    p.cancel("Encryption key rotation failed.")
    console.error(formatRotationError(error))

    await writeAbortAuditIfPossible(state.client, state.operationId, error)
    process.exit(1)
  } finally {
    await releaseRotationLock(state.lock)

    if (state.client) {
      await state.client.end()
    }
  }
}

if (isDirectRun(import.meta.url)) {
  main()
}
