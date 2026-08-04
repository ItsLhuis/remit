import { spawn } from "node:child_process"
import { createReadStream } from "node:fs"
import { pipeline } from "node:stream/promises"

import { waitForProcess } from "../utils/process"

import { RestoreCliError } from "./errors"
import { redactRestoreReason } from "./redact"

export async function restoreDatabaseDump(
  databaseDumpPath: string,
  databaseUrl: string
): Promise<void> {
  const args = [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--single-transaction",
    "--dbname",
    databaseUrl
  ]
  // Shell mode on Windows lets PATHEXT resolve pg_restore.exe or a pg_restore.cmd shim; arguments
  // are passed as an array so the shell never receives unescaped input. Matches how
  // dumpDatabaseToTempFile spawns pg_dump.
  const child = spawn("pg_restore", args, {
    env: {
      ...process.env,
      PG_COLOR: "never"
    },
    shell: process.platform === "win32",
    stdio: ["pipe", "ignore", "pipe"]
  })
  let stderr = ""

  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-4000)
  })

  const pipeResult = pipeline(createReadStream(databaseDumpPath), child.stdin).catch(
    (error: unknown) => error
  )
  const exitCode = await waitForProcess(child)
  const pipeError = await pipeResult

  if (exitCode !== 0) {
    throw new RestoreCliError(
      `pg_restore failed. Database changes were not committed because --single-transaction is enabled. ${redactRestoreReason(stderr)}`,
      "pg-restore-failed"
    )
  }

  if (pipeError instanceof Error) {
    throw new RestoreCliError(
      "pg_restore input stream failed before the database restore completed.",
      "pg-restore-input-failed"
    )
  }
}
