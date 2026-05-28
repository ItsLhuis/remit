// @integration
import { afterEach, expect, test } from "vitest"

import { createHash } from "node:crypto"

import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises"

import os from "node:os"

import path from "node:path"
import { createGunzip } from "node:zlib"

import { PassThrough } from "node:stream"

import { settings } from "@/database/schema"
import { database } from "@/tests/integration/database"

import { decryptStream, readArchiveHeader } from "../../archive/header"

import { startS3TestServer } from "../../destination/testing/s3TestServer"

const originalPath = process.env.PATH
const originalUploadsDir = process.env.REMIT_UPLOADS_DIR
const testBucket = "remit-test"

afterEach(async () => {
  process.env.PATH = originalPath

  if (originalUploadsDir) {
    process.env.REMIT_UPLOADS_DIR = originalUploadsDir
  } else {
    delete process.env.REMIT_UPLOADS_DIR
  }
})

test("writes a decryptable local backup archive when Postgres and uploads are available", async () => {
  const tempRoot = await makeTempDirectory()
  const uploadsDir = path.join(tempRoot, "uploads")
  const outputPath = path.join(tempRoot, "backups", "fixture.remitbak")
  const pgDumpShimDir = path.join(tempRoot, "bin")
  await mkdir(path.join(uploadsDir, "avatars", "user-1"), { recursive: true })
  await mkdir(pgDumpShimDir, { recursive: true })
  await writeFile(path.join(uploadsDir, "avatars", "user-1", "avatar.txt"), "avatar fixture")
  await writePgDumpShim(pgDumpShimDir)

  process.env.PATH = `${pgDumpShimDir}${path.delimiter}${originalPath ?? ""}`
  process.env.REMIT_UPLOADS_DIR = uploadsDir

  await database.insert(settings).values({})

  const { runBackup } = await import("../runBackup")
  const schema = await import("@/database/schema")
  const result = await runBackup(database, schema, {
    databaseUrl: "postgresql://remit_test:remit_test@localhost:5433/remit_test",
    dryRun: false,
    encryptionKey: Buffer.from("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "base64"),
    help: false,
    output: outputPath,
    remitDataDir: tempRoot,
    yes: true
  })

  const archive = await readFile(result.archivePath)
  const header = readArchiveHeader(archive.subarray(0, 64))
  const ciphertext = archive.subarray(64, -16)
  const authTag = archive.subarray(-16)
  const tar = await decryptAndGunzip(ciphertext, authTag, header.iv)
  const entries = parseTarEntries(tar)
  const manifest = JSON.parse(entries.get("manifest.json")?.toString("utf8") ?? "{}") as {
    archiveFormatVersion?: number
    components?: {
      database?: { sha256?: string; size?: number }
      uploads?: { fileCount?: number; sha256Manifest?: string; totalSize?: number }
    }
    destination?: string
    encryption?: { keyFingerprint?: string }
  }
  const checksums = entries.get("checksums.sha256")
  const databaseDump = entries.get("database/remit.dump")
  const upload = entries.get("uploads/avatars/user-1/avatar.txt")
  const [settingsRow] = await database.select().from(settings)

  expect(header.archiveFormatVersion).toBe(1)
  expect(manifest.archiveFormatVersion).toBe(1)
  expect(manifest.destination).toBe("local")
  expect(manifest.encryption?.keyFingerprint).toBe(`sha256:${header.keyFingerprint}`)
  expect(databaseDump).toBeDefined()
  expect(upload?.toString("utf8")).toBe("avatar fixture")
  expect(manifest.components?.database?.sha256).toBe(sha256(databaseDump ?? Buffer.alloc(0)))
  expect(manifest.components?.database?.size).toBe(databaseDump?.length)
  expect(manifest.components?.uploads?.fileCount).toBe(1)
  expect(manifest.components?.uploads?.totalSize).toBe(Buffer.byteLength("avatar fixture"))
  expect(manifest.components?.uploads?.sha256Manifest).toBe(sha256(checksums ?? Buffer.alloc(0)))
  expect(checksums?.toString("utf8")).toContain(
    `${sha256(upload ?? Buffer.alloc(0))}  uploads/avatars/user-1/avatar.txt`
  )
  expect(settingsRow?.backupLastSuccessAt).toBeInstanceOf(Date)
  expect(settingsRow?.backupLastFailureAt).toBeNull()
  expect(settingsRow?.backupLastFailureReason).toBeNull()

  await rm(tempRoot, { recursive: true, force: true })
})

test("uploads an encrypted remote backup archive and applies retention cleanup", async () => {
  const tempRoot = await makeTempDirectory()
  const uploadsDir = path.join(tempRoot, "uploads")
  const pgDumpShimDir = path.join(tempRoot, "bin")
  await mkdir(uploadsDir, { recursive: true })
  await mkdir(pgDumpShimDir, { recursive: true })
  await writePgDumpShim(pgDumpShimDir)
  const s3 = await startS3TestServer()

  try {
    process.env.PATH = `${pgDumpShimDir}${path.delimiter}${originalPath ?? ""}`
    process.env.REMIT_UPLOADS_DIR = uploadsDir

    const staleKey = "remit-backups/2020/01/remit-backup-stale.remitbak"
    s3.objects.set(staleKey, {
      body: Buffer.from("stale archive"),
      createdAt: new Date("2020-01-01T00:00:00.000Z")
    })

    await database.insert(settings).values({
      backupDestination: "s3",
      backupRetentionDaily: 0,
      backupRetentionMonthly: 0,
      backupRetentionWeekly: 0,
      backupS3AccessKey: "test-access-key",
      backupS3Bucket: testBucket,
      backupS3Endpoint: s3.endpoint,
      backupS3Region: "us-east-1",
      backupS3SecretKey: "test-secret-key"
    })

    const { runBackup } = await import("../runBackup")
    const schema = await import("@/database/schema")
    const result = await runBackup(database, schema, {
      databaseUrl: "postgresql://remit_test:remit_test@localhost:5433/remit_test",
      dryRun: false,
      encryptionKey: Buffer.from("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "base64"),
      help: false,
      output: null,
      remitDataDir: tempRoot,
      yes: true
    })

    const [settingsRow] = await database.select().from(settings)
    const freshKey = result.archivePath.replace("remit://s3/", "")

    expect(result.archivePath).toMatch(/^remit:\/\/s3\/remit-backups\/\d{4}\/\d{2}\/.+\.remitbak$/)
    expect(s3.objects.has(staleKey)).toBe(false)
    expect(Array.from(s3.objects.keys())).toEqual([freshKey])
    expect(settingsRow?.backupLastSuccessAt).toBeInstanceOf(Date)
    expect(settingsRow?.backupLastFailureAt).toBeNull()
    expect(settingsRow?.backupLastFailureReason).toBeNull()
  } finally {
    await s3.close()
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test("preserves the previous successful backup timestamp when remote upload fails", async () => {
  const tempRoot = await makeTempDirectory()
  const uploadsDir = path.join(tempRoot, "uploads")
  const pgDumpShimDir = path.join(tempRoot, "bin")
  const lastSuccessAt = new Date("2026-05-01T00:00:00.000Z")
  await mkdir(uploadsDir, { recursive: true })
  await mkdir(pgDumpShimDir, { recursive: true })
  await writePgDumpShim(pgDumpShimDir)

  process.env.PATH = `${pgDumpShimDir}${path.delimiter}${originalPath ?? ""}`
  process.env.REMIT_UPLOADS_DIR = uploadsDir

  await database.insert(settings).values({
    backupDestination: "s3",
    backupLastSuccessAt: lastSuccessAt,
    backupS3AccessKey: "minioadmin",
    backupS3Bucket: testBucket,
    backupS3Endpoint: "http://127.0.0.1:1",
    backupS3Region: "us-east-1",
    backupS3SecretKey: "minioadmin"
  })

  const { runBackup } = await import("../runBackup")
  const schema = await import("@/database/schema")

  await expect(
    runBackup(database, schema, {
      databaseUrl: "postgresql://remit_test:remit_test@localhost:5433/remit_test",
      dryRun: false,
      encryptionKey: Buffer.from("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "base64"),
      help: false,
      output: null,
      remitDataDir: tempRoot,
      yes: true
    })
  ).rejects.toThrow()

  const [settingsRow] = await database.select().from(settings)

  expect(settingsRow?.backupLastSuccessAt?.toISOString()).toBe(lastSuccessAt.toISOString())
  expect(settingsRow?.backupLastFailureAt).toBeInstanceOf(Date)
  expect(settingsRow?.backupLastFailureReason).toBeTruthy()

  await rm(tempRoot, { recursive: true, force: true })
})

async function makeTempDirectory(): Promise<string> {
  return await import("node:fs/promises").then((fs) =>
    fs.mkdtemp(path.join(os.tmpdir(), "remit-backup-"))
  )
}

async function writePgDumpShim(directory: string): Promise<void> {
  if (process.platform === "win32") {
    const scriptPath = path.join(directory, "pg_dump.cmd")
    await writeFile(
      scriptPath,
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

async function decryptAndGunzip(ciphertext: Buffer, authTag: Buffer, iv: Buffer): Promise<Buffer> {
  const chunks: Buffer[] = []
  const key = Buffer.from("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "base64")
  const stream = PassThrough.from(ciphertext)
    .pipe(decryptStream(key, iv, authTag))
    .pipe(createGunzip())

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

function parseTarEntries(tar: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>()
  let offset = 0

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)

    if (header.equals(Buffer.alloc(512))) break

    const name = readTarString(header, 0, 100)
    const prefix = readTarString(header, 345, 155)
    const fullName = prefix ? `${prefix}/${name}` : name
    const size = Number.parseInt(readTarString(header, 124, 12).trim(), 8)
    const contentStart = offset + 512
    const contentEnd = contentStart + size

    entries.set(fullName, Buffer.from(tar.subarray(contentStart, contentEnd)))

    offset = contentStart + Math.ceil(size / 512) * 512
  }

  return entries
}

function readTarString(buffer: Buffer, offset: number, length: number): string {
  const field = buffer.subarray(offset, offset + length)
  const end = field.indexOf(0)

  return field.subarray(0, end === -1 ? field.length : end).toString("utf8")
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}
