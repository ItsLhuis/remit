import { chmod, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vitest"

import {
  acquireBackupLock,
  findBackupLockHolder,
  releaseBackupLock
} from "@/lib/backups/backupLock"
import { storage } from "@/lib/storage/s3"

import * as schema from "@/database/schema"

import { client, database } from "@/tests/integration/database"

import { takePreRestoreSnapshot } from "../../restore/snapshot"
import { runOperatorBackup } from "../runBackup"

const key = Buffer.from("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "base64")
const databaseUrl = "postgresql://remit_test:remit_test@localhost:5433/remit_test"
const originalPath = process.env.PATH

let remitDataDir: string

// The same delegation to the Dockerized test Postgres the backup command's own integration test
// uses: `pg_dump` is not on a developer host.
async function writePgDumpShim(directory: string): Promise<void> {
  if (process.platform === "win32") {
    await writeFile(
      path.join(directory, "pg_dump.cmd"),
      [
        "@echo off",
        "docker compose -f docker-compose.test.yml exec -T -e PGPASSWORD=remit_test database_test pg_dump -U remit_test -d remit_test %*"
      ].join("\r\n")
    )

    return
  }

  const scriptPath = path.join(directory, "pg_dump")

  await writeFile(
    scriptPath,
    [
      "#!/usr/bin/env sh",
      'docker compose -f docker-compose.test.yml exec -T -e PGPASSWORD=remit_test database_test pg_dump -U remit_test -d remit_test "$@"'
    ].join("\n")
  )
  await chmod(scriptPath, 0o755)
}

function operatorBackup() {
  return runOperatorBackup(client, database, schema, {
    databaseUrl,
    destinationOverride: "local",
    dryRun: false,
    encryptionKey: key,
    help: false,
    output: null,
    remitDataDir,
    yes: true
  })
}

async function listArchives(): Promise<string[]> {
  try {
    return (await readdir(path.join(remitDataDir, "backups"))).filter((name) =>
      name.endsWith(".remitbak")
    )
  } catch {
    return []
  }
}

beforeAll(async () => {
  const shimDirectory = await mkdtemp(path.join(os.tmpdir(), "remit-backup-lock-bin-"))

  await writePgDumpShim(shimDirectory)

  process.env.PATH = `${shimDirectory}${path.delimiter}${originalPath ?? ""}`

  await storage.ensureBucket("public")
  await storage.ensureBucket("documents")
})

afterAll(() => {
  process.env.PATH = originalPath
})

beforeEach(async () => {
  remitDataDir = await mkdtemp(path.join(os.tmpdir(), "remit-backup-lock-"))
})

afterEach(async () => {
  await rm(remitDataDir, { recursive: true, force: true })
})

test("a manual backup is refused, naming the holder, while a scheduled one runs", async () => {
  const lock = await acquireBackupLock(client, "scheduled-backup")

  try {
    await expect(operatorBackup()).rejects.toThrow(
      /^Refusing backup: a scheduled backup \(running since .+\) holds the backup lock/
    )
    expect(await listArchives()).toEqual([])
  } finally {
    await releaseBackupLock(lock)
  }
})

test("a manual backup runs once the lock is free and leaves it free behind it", async () => {
  const result = await operatorBackup()

  expect(result.wrote).toBe(true)
  expect(await listArchives()).toHaveLength(1)
  expect(await findBackupLockHolder(client)).toBeNull()
})

test("a second holder cannot take the lock the first holds", async () => {
  const restoreLock = await acquireBackupLock(client, "restore")

  try {
    const secondLock = await acquireBackupLock(client, "scheduled-backup")

    expect(secondLock).toBeNull()
    expect((await findBackupLockHolder(client))?.holder).toBe("restore")
  } finally {
    await releaseBackupLock(restoreLock)
  }
})

test("a restore's own pre-restore snapshot runs under the lock the restore holds", async () => {
  const restoreLock = await acquireBackupLock(client, "restore")
  const snapshotPath = path.join(remitDataDir, "backups", "snapshot.pre-restore.remitbak")

  try {
    await takePreRestoreSnapshot(database, schema, {
      databaseUrl,
      encryptionKey: key,
      outputPath: snapshotPath,
      remitDataDir
    })
  } finally {
    await releaseBackupLock(restoreLock)
  }

  expect(await readdir(path.dirname(snapshotPath))).toContain("snapshot.pre-restore.remitbak")
})
