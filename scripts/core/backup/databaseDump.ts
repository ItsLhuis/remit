import { spawn } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { once } from "node:events"
import { createWriteStream } from "node:fs"
import { rm } from "node:fs/promises"
import path from "node:path"
import { type Readable, type Writable } from "node:stream"
import { finished } from "node:stream/promises"

import { waitForProcess } from "../utils/process"

export type DatabaseDumpDescriptor = {
  path: string
  sha256: string
  size: number
}

export class DatabaseDumpError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message)
  }
}

export async function dumpDatabaseToTempFile(
  databaseUrl: string,
  tempDir: string
): Promise<DatabaseDumpDescriptor> {
  const dumpPath = path.join(tempDir, `remit-database-${randomUUID()}.dump`)
  const output = createWriteStream(dumpPath, { flags: "wx" })
  const hash = createHash("sha256")
  let size = 0
  let stderr = ""

  // On Windows pg_dump is resolved through the shell so PATHEXT finds pg_dump.exe
  // or pg_dump.cmd. Arguments are a fixed static array; the shell never receives
  // untrusted input.
  const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-privileges"], {
    env: {
      ...process.env,
      ...databaseUrlToPgEnv(databaseUrl),
      PG_COLOR: "never"
    },
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"]
  })

  if (!child.stdout || !child.stderr) {
    throw new DatabaseDumpError("pg_dump did not expose stdout/stderr streams.")
  }

  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-4000)
  })

  const stdoutPromise = writeDumpStream(child.stdout, output, hash, (bytes) => {
    size += bytes
  })
  const exitPromise = waitForProcess(child)

  try {
    const [, exitCode] = await Promise.all([stdoutPromise, exitPromise])

    if (exitCode !== 0) {
      throw new DatabaseDumpError(
        `pg_dump failed. Run pnpm services:up first and confirm the app container can reach PostgreSQL. ${stderr}`
      )
    }

    return { path: dumpPath, sha256: hash.digest("hex"), size }
  } catch (error) {
    child.kill("SIGTERM")
    await rm(dumpPath, { force: true })
    throw error
  }
}

async function writeDumpStream(
  source: Readable,
  output: Writable,
  hash: ReturnType<typeof createHash>,
  onChunk: (bytes: number) => void
): Promise<void> {
  try {
    for await (const chunk of source) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      hash.update(buffer)
      onChunk(buffer.length)

      if (!output.write(buffer)) {
        await once(output, "drain")
      }
    }
  } finally {
    output.end()
  }

  await finished(output)
}

export function databaseUrlToPgEnv(databaseUrl: string): Record<string, string> {
  const url = new URL(databaseUrl)
  const values: Record<string, string | undefined> = {
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
    PGHOST: url.hostname,
    PGPASSWORD: url.password ? decodeURIComponent(url.password) : undefined,
    PGPORT: url.port || undefined,
    PGSSLMODE: url.searchParams.get("sslmode") ?? undefined,
    PGUSER: url.username ? decodeURIComponent(url.username) : undefined
  }

  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]))
  )
}
