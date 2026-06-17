import { createHash } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PassThrough } from "node:stream"
import { gzipSync } from "node:zlib"

// @integration
import { afterEach, expect, test } from "vitest"

import { auditLogs, clients, settings } from "@/database/schema"

import pkg from "@/package.json"
import { client, database } from "@/tests/integration/database"

import {
  ARCHIVE_HEADER_LENGTH,
  computeKeyFingerprint,
  encryptStream,
  writeArchiveHeader
} from "../../archive/header"
import { buildBackupManifest, serializeBackupManifest, sha256Hex } from "../../backup/manifest"
import { decryptValue, encryptValue } from "../../encryption/values"
import { readAndValidateRestoreHeader } from "../../restore/header"
import { verifyArchivePayload } from "../../restore/verifyArchive"
import { runKeyRotation } from "../runRotation"

const oldKey = Buffer.alloc(32, 0)
const newKey = Buffer.alloc(32, 1)
const otherKey = Buffer.alloc(32, 2)
const databaseUrl = "postgresql://remit_test:remit_test@localhost:5433/remit_test"
const tempRoots: string[] = []
const rotationLockId = "5928229461845757780"

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true, force: true }))
  )
})

test("re-encrypts registered columns and local backup archives", async () => {
  const tempRoot = await makeTempDirectory()
  const backupPath = path.join(tempRoot, "backups", "fixture.remitbak")
  await seedEncryptedRows()
  await writeFile(backupPath, await buildMinimalArchive(oldKey))
  const schema = await import("@/database/schema")

  await runKeyRotation(database, client, schema, {
    backupFile: backupPath,
    currentEnvKey: oldKey,
    databaseUrl,
    dryRun: false,
    help: false,
    newKey,
    oldKey,
    remitDataDir: tempRoot,
    resume: false
  })

  const [settingsRow] = await client<Array<Record<string, unknown>>>`
    SELECT payment_iban, smtp_pass
    FROM settings
    LIMIT 1
  `
  const [clientRow] = await client<Array<Record<string, unknown>>>`
    SELECT notes
    FROM clients
    LIMIT 1
  `
  const header = await readAndValidateRestoreHeader(backupPath, newKey)
  const verified = await verifyArchivePayload({
    archivePath: backupPath,
    currentAppVersion: pkg.version,
    encryptionKey: newKey,
    header,
    mode: "verify-only"
  })
  const auditEvents = await database.select({ event: auditLogs.event }).from(auditLogs)

  expect(decryptValue(readEncrypted(settingsRow, "payment_iban"), newKey)).toBe("PT500001")
  expect(decryptValue(readEncrypted(settingsRow, "smtp_pass"), newKey)).toBe("smtp-secret")
  expect(decryptValue(readEncrypted(clientRow, "notes"), newKey)).toBe("Client notes")
  expect(() => decryptValue(readEncrypted(clientRow, "notes"), oldKey)).toThrow()
  expect(verified.manifest.encryption.keyFingerprint).toBe(
    `sha256:${computeKeyFingerprint(newKey)}`
  )
  expect(auditEvents.map((row) => row.event)).toEqual(
    expect.arrayContaining([
      "instance.key_rotation.started",
      "instance.key_rotation.table_completed",
      "instance.key_rotation.backup_reencrypted",
      "instance.key_rotation.completed"
    ])
  )
})

test("resumes after a table-level failure from the last completed marker", async () => {
  const tempRoot = await makeTempDirectory()
  const backupPath = path.join(tempRoot, "backups", "resume.remitbak")
  await seedEncryptedRows()
  await writeFile(backupPath, await buildMinimalArchive(oldKey))
  await client`
    UPDATE settings
    SET payment_iban = 'corrupted'
  `
  const schema = await import("@/database/schema")

  await expect(
    runKeyRotation(database, client, schema, {
      backupFile: backupPath,
      currentEnvKey: oldKey,
      databaseUrl,
      dryRun: false,
      help: false,
      newKey,
      oldKey,
      remitDataDir: tempRoot,
      resume: false
    })
  ).rejects.toThrow("decrypt failed for settings.payment_iban")

  await client`
    UPDATE settings
    SET payment_iban = ${encryptValue("PT500001", oldKey)}
  `

  await runKeyRotation(database, client, schema, {
    backupFile: null,
    currentEnvKey: oldKey,
    databaseUrl,
    dryRun: false,
    help: false,
    newKey,
    oldKey,
    remitDataDir: tempRoot,
    resume: true
  })

  const [settingsRow] = await client<Array<Record<string, unknown>>>`
    SELECT payment_iban
    FROM settings
    LIMIT 1
  `
  const [clientRow] = await client<Array<Record<string, unknown>>>`
    SELECT notes
    FROM clients
    LIMIT 1
  `

  expect(decryptValue(readEncrypted(settingsRow, "payment_iban"), newKey)).toBe("PT500001")
  expect(decryptValue(readEncrypted(clientRow, "notes"), newKey)).toBe("Client notes")
})

test("dry-run verifies the plan without writing audit entries or rotating values", async () => {
  const tempRoot = await makeTempDirectory()
  const backupPath = path.join(tempRoot, "backups", "dry-run.remitbak")
  await seedEncryptedRows()
  await writeFile(backupPath, await buildMinimalArchive(oldKey))
  const schema = await import("@/database/schema")

  await runKeyRotation(database, client, schema, {
    backupFile: backupPath,
    currentEnvKey: oldKey,
    databaseUrl,
    dryRun: true,
    help: false,
    newKey,
    oldKey,
    remitDataDir: tempRoot,
    resume: false
  })

  const [clientRow] = await client<Array<Record<string, unknown>>>`
    SELECT notes
    FROM clients
    LIMIT 1
  `
  const auditEvents = await database.select({ event: auditLogs.event }).from(auditLogs)

  expect(decryptValue(readEncrypted(clientRow, "notes"), oldKey)).toBe("Client notes")
  expect(() => decryptValue(readEncrypted(clientRow, "notes"), newKey)).toThrow()
  expect(auditEvents).toEqual([])
})

test("refuses rotation when old and new keys are equal", async () => {
  const tempRoot = await makeTempDirectory()
  const schema = await import("@/database/schema")

  await expect(
    runKeyRotation(database, client, schema, {
      backupFile: null,
      currentEnvKey: oldKey,
      databaseUrl,
      dryRun: true,
      help: false,
      newKey: oldKey,
      oldKey,
      remitDataDir: tempRoot,
      resume: false
    })
  ).rejects.toThrow("old and new encryption keys are identical")
})

test("refuses rotation when a key has the wrong byte length", async () => {
  const tempRoot = await makeTempDirectory()
  const schema = await import("@/database/schema")

  await expect(
    runKeyRotation(database, client, schema, {
      backupFile: null,
      currentEnvKey: Buffer.alloc(31, 0),
      databaseUrl,
      dryRun: true,
      help: false,
      newKey,
      oldKey: Buffer.alloc(31, 0),
      remitDataDir: tempRoot,
      resume: false
    })
  ).rejects.toThrow("old key must decode to exactly 32 bytes")
})

test("refuses rotation when the advisory lock is already held", async () => {
  const tempRoot = await makeTempDirectory()
  const schema = await import("@/database/schema")
  const reserved = await client.reserve()

  try {
    await reserved`
      SELECT pg_advisory_lock(${rotationLockId}::bigint)
    `

    await expect(
      runKeyRotation(database, client, schema, {
        backupFile: null,
        currentEnvKey: oldKey,
        databaseUrl,
        dryRun: true,
        help: false,
        newKey: otherKey,
        oldKey,
        remitDataDir: tempRoot,
        resume: false
      })
    ).rejects.toThrow("another encryption key rotation is already in progress")
  } finally {
    await reserved`
      SELECT pg_advisory_unlock(${rotationLockId}::bigint)
    `
    reserved.release()
  }
})

async function seedEncryptedRows(): Promise<void> {
  await database.insert(settings).values({
    paymentIban: "PT500001",
    smtpPass: "smtp-secret"
  })
  await database.insert(clients).values({
    email: "client@example.com",
    name: "Client",
    notes: "Client notes"
  })
}

async function buildMinimalArchive(encryptionKey: Buffer): Promise<Buffer> {
  const databaseDump = Buffer.from("database dump")
  const checksums = Buffer.from(`${sha256(databaseDump)}  database/remit.dump\n`, "utf8")
  const manifest = buildBackupManifest({
    appVersion: pkg.version,
    checksumsSha256: sha256Hex(checksums),
    components: {
      database: {
        size: databaseDump.length,
        sha256: sha256(databaseDump)
      },
      uploads: {
        fileCount: 0,
        totalSize: 0
      }
    },
    createdAt: "2026-05-26T12:00:00.000Z",
    destination: "local",
    encryptionKey,
    schemaMigrationId: "0001_initial"
  })
  const tar = Buffer.concat([
    tarFile("manifest.json", serializeBackupManifest(manifest)),
    tarFile("checksums.sha256", checksums),
    tarFile("database/remit.dump", databaseDump),
    Buffer.alloc(1024)
  ])
  const iv = Buffer.from("123456789012")
  const header = Buffer.alloc(ARCHIVE_HEADER_LENGTH)
  writeArchiveHeader(header, { iv, keyFingerprint: computeKeyFingerprint(encryptionKey) })
  const encrypted = await encryptBuffer(gzipSync(tar), encryptionKey, iv)

  return Buffer.concat([header, encrypted.ciphertext, encrypted.authTag])
}

async function encryptBuffer(
  plaintext: Buffer,
  encryptionKey: Buffer,
  iv: Buffer
): Promise<{ authTag: Buffer; ciphertext: Buffer }> {
  const encryption = encryptStream(encryptionKey, iv)
  const chunks: Buffer[] = []

  for await (const chunk of PassThrough.from(plaintext).pipe(encryption.stream)) {
    chunks.push(Buffer.from(chunk))
  }

  return {
    authTag: encryption.getAuthTag(),
    ciphertext: Buffer.concat(chunks)
  }
}

function tarFile(name: string, content: Buffer): Buffer {
  return Buffer.concat([
    tarHeader(name, content.length),
    content,
    Buffer.alloc(paddingFor(content.length))
  ])
}

function tarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512)
  writeAscii(header, name, 0, 100)
  writeOctal(header, 0o644, 100, 8)
  writeOctal(header, 0, 108, 8)
  writeOctal(header, 0, 116, 8)
  writeOctal(header, size, 124, 12)
  writeOctal(header, 0, 136, 12)
  header.fill(0x20, 148, 156)
  header.write("0", 156, 1, "ascii")
  header.write("ustar\0", 257, 6, "ascii")
  header.write("00", 263, 2, "ascii")
  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  writeOctal(header, checksum, 148, 8)

  return header
}

function writeAscii(buffer: Buffer, value: string, offset: number, length: number): void {
  Buffer.from(value, "utf8").copy(buffer, offset, 0, length)
}

function writeOctal(buffer: Buffer, value: number, offset: number, length: number): void {
  buffer.write(`${value.toString(8).padStart(length - 2, "0")}\0 `, offset, length, "ascii")
}

function paddingFor(size: number): number {
  const remainder = size % 512

  return remainder === 0 ? 0 : 512 - remainder
}

function readEncrypted(row: Record<string, unknown> | undefined, key: string): string {
  const value = row?.[key]

  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be encrypted text.`)
  }

  return value
}

async function makeTempDirectory(): Promise<string> {
  const tempRoot = await import("node:fs/promises").then((fs) =>
    fs.mkdtemp(path.join(os.tmpdir(), "remit-key-rotation-"))
  )
  tempRoots.push(tempRoot)
  await mkdir(path.join(tempRoot, "backups"), { recursive: true })

  return tempRoot
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}
