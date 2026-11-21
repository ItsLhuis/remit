import { createReadStream } from "node:fs"
import { pipeline } from "node:stream/promises"

import { databaseUrlToPgEnv } from "../backup/databaseDump"
import { spawnPostgresTool, waitForProcess } from "../utils/process"

import { RestoreCliError } from "./errors"
import { redactRestoreReason } from "./redact"

export async function restoreDatabaseDump(
  databaseDumpPath: string,
  databaseUrl: string
): Promise<void> {
  // The target travels in the environment, the way `pg_dump` receives it, so the command line holds
  // nothing but static flags (`utils/process.ts`). `--dbname` is still required — without it
  // pg_restore writes SQL to stdout instead of restoring — and an empty connection URI takes every
  // part it leaves out from the PG* variables.
  const child = spawnPostgresTool(
    "pg_restore",
    [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--single-transaction",
      "--dbname=postgresql://"
    ],
    {
      env: {
        ...process.env,
        ...databaseUrlToPgEnv(databaseUrl),
        PG_COLOR: "never"
      },
      stdio: ["pipe", "ignore", "pipe"]
    }
  )
  let stderr = ""

  if (!child.stdin || !child.stderr) {
    throw new RestoreCliError(
      "pg_restore did not expose its input and error streams.",
      "pg-restore-streams"
    )
  }

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
