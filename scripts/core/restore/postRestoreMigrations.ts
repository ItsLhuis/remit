import path from "node:path"
import { fileURLToPath } from "node:url"

import { spawn } from "node:child_process"

import { waitForProcess } from "../utils/process"

import { RestoreCliError } from "./errors"
import { redactRestoreReason } from "./redact"

export async function runPostRestoreMigrations(databaseUrl: string): Promise<void> {
  // Resolve sibling migrate module relative to this file and match its extension.
  // tsup emits restore.js and migrate.js side by side in scripts/dist, while
  // running from source executes restore.ts/migrate.ts through tsx. Run .ts
  // sibling under tsx loader and compiled .js sibling on plain node, so spawn
  // works regardless of how command was invoked.
  const currentModulePath = fileURLToPath(import.meta.url)
  const moduleExtension = path.extname(currentModulePath)
  // After build, this module sits in scripts/dist next to migrate.js (tsup
  // flattens the output). From source, it lives at scripts/core/restore/
  // postRestoreMigrations.ts and the migrate entrypoint is at scripts/migrate.ts.
  const migrateScript =
    moduleExtension === ".ts"
      ? path.resolve(path.dirname(currentModulePath), "../../migrate.ts")
      : path.join(path.dirname(currentModulePath), "migrate.js")
  const migrateArgs =
    moduleExtension === ".ts" ? ["--import", "tsx", migrateScript] : [migrateScript]
  const child = spawn(process.execPath, migrateArgs, {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    stdio: ["ignore", "pipe", "pipe"]
  })
  let output = ""

  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk: string) => {
    output = `${output}${chunk}`.slice(-4000)
  })
  child.stderr.on("data", (chunk: string) => {
    output = `${output}${chunk}`.slice(-4000)
  })

  const exitCode = await waitForProcess(child)

  if (exitCode !== 0) {
    throw new RestoreCliError(
      `Post-restore migrations failed. ${redactRestoreReason(output)}`,
      "post-restore-migrations-failed"
    )
  }
}
