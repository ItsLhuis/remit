import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { waitForProcess } from "../utils/process"

import { RestoreCliError } from "./errors"
import { redactRestoreReason } from "./redact"

export async function runPostRestoreMigrations(databaseUrl: string): Promise<void> {
  // The sibling migrate module is resolved relative to this file and matched on its extension,
  // because tsup emits restore.js and migrate.js side by side in scripts/dist while running from
  // source executes restore.ts and migrate.ts through tsx. A .ts sibling is spawned under the tsx
  // loader and a compiled .js sibling on plain node, so the spawn works however the command was
  // invoked.
  const currentModulePath = fileURLToPath(import.meta.url)
  const moduleExtension = path.extname(currentModulePath)
  // After a build this module sits in scripts/dist next to migrate.js, since tsup flattens the
  // output. From source it lives at scripts/core/restore/postRestoreMigrations.ts and the migrate
  // entrypoint is at scripts/migrate.ts.
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
