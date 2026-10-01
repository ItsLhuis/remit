import { createHash } from "node:crypto"
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PassThrough } from "node:stream"
import { createGunzip } from "node:zlib"

import { afterEach, beforeEach, expect, test } from "vitest"

import { storage } from "@/lib/storage/s3"

import { settings } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { decryptStream, readArchiveHeader } from "../../archive/header"
import { startS3TestServer } from "../../destination/testing/s3TestServer"

const originalPath = process.env.PATH
const testBucket = "remit-test"

// The suite's own buckets, emptied before each test so an archive holds exactly what the test put.
beforeEach(async () => {
  for (const role of ["public", "documents"] as const) {
    await storage.ensureBucket(role)

    for await (const object of storage.listObjects(role))
      await storage.deleteObject(role, object.key)
  }
})

afterEach(async () => {
  process.env.PATH = originalPath
})

test("writes a decryptable local archive carrying the database and every stored file", async () => {
  const tempRoot = await makeTempDirectory()
  const outputPath = path.join(tempRoot, "backups", "fixture.remitbak")
  const pgDumpShimDir = path.join(tempRoot, "bin")
  const avatar = Buffer.from("avatar fixture")
  const attachment = Buffer.from("attachment fixture")
  await mkdir(pgDumpShimDir, { recursive: true })
  await writePgDumpShim(pgDumpShimDir)
  await storage.putObject({
    role: "public",
    key: "avatars/user-1/avatar.png",
    body: avatar,
    contentLength: avatar.length,
    contentType: "image/png"
  })
  await storage.putObject({
    role: "documents",
    key: "attachments/a.pdf",
    body: attachment,
    contentLength: attachment.length,
    contentType: "application/pdf"
  })

  process.env.PATH = `${pgDumpShimDir}${path.delimiter}${originalPath ?? ""}`

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
      objects?: {
        buckets?: Record<string, { fileCount?: number; totalSize?: number }>
        contentTypes?: Record<string, string>
        sha256Manifest?: string
      }
    }
    destination?: string
    encryption?: { keyFingerprint?: string }
  }
  const checksums = entries.get("checksums.sha256")
  const databaseDump = entries.get("database/remit.dump")
  const archivedAvatar = entries.get("objects/public/avatars/user-1/avatar.png")
  const archivedAttachment = entries.get("objects/documents/attachments/a.pdf")
  const [settingsRow] = await database.select().from(settings)

  expect(header.archiveFormatVersion).toBe(2)
  expect(manifest.archiveFormatVersion).toBe(2)
  expect(manifest.destination).toBe("local")
  expect(manifest.encryption?.keyFingerprint).toBe(`sha256:${header.keyFingerprint}`)
  expect(databaseDump).toBeDefined()
  expect(archivedAvatar?.equals(avatar)).toBe(true)
  expect(archivedAttachment?.equals(attachment)).toBe(true)
  expect(manifest.components?.database?.sha256).toBe(sha256(databaseDump ?? Buffer.alloc(0)))
  expect(manifest.components?.database?.size).toBe(databaseDump?.length)
  expect(manifest.components?.objects?.buckets).toEqual({
    public: { fileCount: 1, totalSize: avatar.length },
    documents: { fileCount: 1, totalSize: attachment.length }
  })
  expect(manifest.components?.objects?.contentTypes).toEqual({
    "objects/public/avatars/user-1/avatar.png": "image/png",
    "objects/documents/attachments/a.pdf": "application/pdf"
  })
  expect(manifest.components?.objects?.sha256Manifest).toBe(sha256(checksums ?? Buffer.alloc(0)))
  expect(checksums?.toString("utf8")).toContain(
    `${sha256(avatar)}  objects/public/avatars/user-1/avatar.png`
  )
  expect(settingsRow?.backupLastSuccessAt).toBeInstanceOf(Date)
  expect(settingsRow?.backupLastFailureAt).toBeNull()
  expect(settingsRow?.backupLastFailureReason).toBeNull()

  await rm(tempRoot, { recursive: true, force: true })
})

test("uploads an encrypted remote backup archive and applies retention cleanup", async () => {
  const tempRoot = await makeTempDirectory()
  const pgDumpShimDir = path.join(tempRoot, "bin")
  await mkdir(pgDumpShimDir, { recursive: true })
  await writePgDumpShim(pgDumpShimDir)
  const s3 = await startS3TestServer()

  try {
    process.env.PATH = `${pgDumpShimDir}${path.delimiter}${originalPath ?? ""}`

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
  const pgDumpShimDir = path.join(tempRoot, "bin")
  const lastSuccessAt = new Date("2026-05-01T00:00:00.000Z")
  await mkdir(pgDumpShimDir, { recursive: true })
  await writePgDumpShim(pgDumpShimDir)

  process.env.PATH = `${pgDumpShimDir}${path.delimiter}${originalPath ?? ""}`

  await database.insert(settings).values({
    backupDestination: "s3",
    backupLastSuccessAt: lastSuccessAt,
    backupS3AccessKey: "unreachable-access-key",
    backupS3Bucket: testBucket,
    backupS3Endpoint: "http://127.0.0.1:1",
    backupS3Region: "us-east-1",
    backupS3SecretKey: "unreachable-secret-key"
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
