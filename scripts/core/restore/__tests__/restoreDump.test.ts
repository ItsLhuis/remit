import { EventEmitter } from "node:events"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PassThrough } from "node:stream"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({ spawnPostgresTool: vi.fn() }))

vi.mock("../../utils/process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/process")>()),
  spawnPostgresTool: mocks.spawnPostgresTool
}))

const DATABASE_URL = "postgresql://remit:s3cret@db.internal:5432/remit?sslmode=require"

let directory: string
let dumpPath: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "remit-restore-dump-"))
  dumpPath = path.join(directory, "remit.dump")

  await writeFile(dumpPath, "dump bytes")
})

afterEach(async () => {
  vi.clearAllMocks()

  await rm(directory, { recursive: true, force: true })
})

// A stand-in for pg_restore that drains its input, optionally writes to stderr, and exits.
function fakePgRestore(options: { exitCode: number; stderr?: string }) {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stderr: new PassThrough()
  })

  child.stdin.on("data", () => undefined)
  child.stdin.on("finish", () => {
    if (options.stderr) child.stderr.write(options.stderr)

    child.stderr.end()
    child.emit("close", options.exitCode)
  })

  mocks.spawnPostgresTool.mockReturnValue(child)
}

test("passes the target in the environment and only static flags on the command line", async () => {
  fakePgRestore({ exitCode: 0 })
  const { restoreDatabaseDump } = await import("../restoreDump")

  await restoreDatabaseDump(dumpPath, DATABASE_URL)

  const [command, args, options] = mocks.spawnPostgresTool.mock.calls[0] as [
    string,
    string[],
    { env: Record<string, string> }
  ]

  expect(command).toBe("pg_restore")
  expect(args).toContain("--dbname=postgresql://")
  expect(args.join(" ")).not.toContain("s3cret")
  expect(options.env).toMatchObject({
    PGHOST: "db.internal",
    PGPORT: "5432",
    PGUSER: "remit",
    PGPASSWORD: "s3cret",
    PGDATABASE: "remit",
    PGSSLMODE: "require"
  })
})

test("reports that nothing was committed when pg_restore exits non-zero", async () => {
  fakePgRestore({ exitCode: 1, stderr: "pg_restore: error: relation already exists" })
  const { restoreDatabaseDump } = await import("../restoreDump")

  await expect(restoreDatabaseDump(dumpPath, DATABASE_URL)).rejects.toThrow(
    "Database changes were not committed"
  )
})
