import { createHash } from "node:crypto"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PassThrough } from "node:stream"
import { gzipSync } from "node:zlib"

import { afterEach, describe, expect, test } from "vitest"

import {
  ARCHIVE_HEADER_LENGTH,
  computeKeyFingerprint,
  encryptStream,
  readArchiveHeader,
  writeArchiveHeader
} from "../../archive/header"
import { buildBackupManifest, serializeBackupManifest, sha256Hex } from "../../backup/manifest"
import { readAndValidateRestoreHeader } from "../header"
import { applyUploadsAtomicSwap } from "../uploadsSwap"
import { verifyArchivePayload } from "../verifyArchive"

const key = Buffer.from("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "base64")
const otherKey = Buffer.from("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=", "base64")
const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true, force: true }))
  )
})

describe("restore archive refusal rules", () => {
  test("refuses a backup file when the magic bytes are invalid", async () => {
    const tempRoot = await makeTempDirectory()
    const archivePath = path.join(tempRoot, "bad-magic.remitbak")
    const archive = await buildArchive()
    archive[0] = 0
    await writeFile(archivePath, archive)

    await expect(readAndValidateRestoreHeader(archivePath, key)).rejects.toThrow(
      "archive is not a Remit backup file"
    )
  })

  test("refuses a backup file when the archive format version is newer", async () => {
    const tempRoot = await makeTempDirectory()
    const archivePath = path.join(tempRoot, "bad-version.remitbak")
    const archive = await buildArchive({ headerVersion: 2 })
    await writeFile(archivePath, archive)

    await expect(readAndValidateRestoreHeader(archivePath, key)).rejects.toThrow(
      "archive format version 2 is newer"
    )
  })

  test("refuses a backup file when the algorithm byte is unsupported", async () => {
    const tempRoot = await makeTempDirectory()
    const archivePath = path.join(tempRoot, "bad-algorithm.remitbak")
    const archive = await buildArchive()
    archive[12] = 0x02
    await writeFile(archivePath, archive)

    await expect(readAndValidateRestoreHeader(archivePath, key)).rejects.toThrow(
      "archive encryption algorithm is not supported"
    )
  })

  test("refuses a backup file when reserved header bytes are non-zero", async () => {
    const tempRoot = await makeTempDirectory()
    const archivePath = path.join(tempRoot, "bad-reserved.remitbak")
    const archive = await buildArchive()
    archive[13] = 1
    await writeFile(archivePath, archive)

    await expect(readAndValidateRestoreHeader(archivePath, key)).rejects.toThrow(
      "archive header reserved bytes are non-zero"
    )
  })

  test("refuses a backup file when the live key fingerprint differs", async () => {
    const tempRoot = await makeTempDirectory()
    const archivePath = path.join(tempRoot, "bad-key.remitbak")
    const archive = await buildArchive()
    await writeFile(archivePath, archive)

    await expect(readAndValidateRestoreHeader(archivePath, otherKey)).rejects.toThrow(
      "different REMIT_ENCRYPTION_KEY"
    )
  })

  test("refuses a backup file when AES-GCM authentication fails", async () => {
    const tempRoot = await makeTempDirectory()
    const archivePath = path.join(tempRoot, "bad-tag.remitbak")
    const archive = await buildArchive()
    archive[archive.length - 1] ^= 1
    await writeFile(archivePath, archive)
    const header = await readAndValidateRestoreHeader(archivePath, key)

    await expect(
      verifyArchivePayload({
        archivePath,
        currentAppVersion: "1.0.0",
        encryptionKey: key,
        header,
        mode: "verify-only"
      })
    ).rejects.toThrow("archive failed integrity check")
  })

  test("refuses a backup file when the manifest version differs from the header", async () => {
    const tempRoot = await makeTempDirectory()
    const archivePath = path.join(tempRoot, "bad-manifest.remitbak")
    const archive = await buildArchive({ manifestVersion: 2 })
    await writeFile(archivePath, archive)
    const header = await readAndValidateRestoreHeader(archivePath, key)

    await expect(
      verifyArchivePayload({
        archivePath,
        currentAppVersion: "1.0.0",
        encryptionKey: key,
        header,
        mode: "verify-only"
      })
    ).rejects.toThrow("manifest archive format does not match")
  })

  test("refuses a backup file when an entry checksum differs", async () => {
    const tempRoot = await makeTempDirectory()
    const archivePath = path.join(tempRoot, "bad-checksum.remitbak")
    const archive = await buildArchive({ databaseChecksum: "f".repeat(64) })
    await writeFile(archivePath, archive)
    const header = await readAndValidateRestoreHeader(archivePath, key)

    await expect(
      verifyArchivePayload({
        archivePath,
        currentAppVersion: "1.0.0",
        encryptionKey: key,
        header,
        mode: "verify-only"
      })
    ).rejects.toThrow("checksum verification failed")
  })

  test("refuses a backup file when the archive app version is newer", async () => {
    const tempRoot = await makeTempDirectory()
    const archivePath = path.join(tempRoot, "newer-app.remitbak")
    const archive = await buildArchive({ appVersion: "9.0.0" })
    await writeFile(archivePath, archive)
    const header = await readAndValidateRestoreHeader(archivePath, key)

    await expect(
      verifyArchivePayload({
        archivePath,
        currentAppVersion: "1.0.0",
        encryptionKey: key,
        header,
        mode: "verify-only"
      })
    ).rejects.toThrow("upgrade the running build")
  })
})

test("verifies an archive without writing staging files when dry-run mode is used", async () => {
  const tempRoot = await makeTempDirectory()
  const archivePath = path.join(tempRoot, "valid.remitbak")
  const workDir = path.join(tempRoot, "work")
  const uploadsStagingDir = path.join(tempRoot, "uploads-staging")
  await writeFile(archivePath, await buildArchive())
  const header = await readAndValidateRestoreHeader(archivePath, key)

  const verified = await verifyArchivePayload({
    archivePath,
    currentAppVersion: "1.0.0",
    encryptionKey: key,
    header,
    mode: "verify-only",
    uploadsStagingDir,
    workDir
  })

  await expect(pathExists(workDir)).resolves.toBe(false)
  await expect(pathExists(uploadsStagingDir)).resolves.toBe(false)
  expect(verified.databaseDumpPath).toBeNull()
  expect(verified.uploadsStagingDir).toBeNull()
})

test("atomically swaps staged uploads into the live uploads directory", async () => {
  const tempRoot = await makeTempDirectory()
  const liveUploadsDir = path.join(tempRoot, "uploads")
  const stagingUploadsDir = path.join(tempRoot, ".uploads.restore-staging-test")
  const restoredPath = path.join(stagingUploadsDir, "client-files", "invoice.pdf")
  await mkdir(path.join(liveUploadsDir, "old"), { recursive: true })
  await mkdir(path.dirname(restoredPath), { recursive: true })
  await writeFile(path.join(liveUploadsDir, "old", "stale.txt"), "stale")
  await writeFile(restoredPath, "restored")

  const result = await applyUploadsAtomicSwap({
    expectedUploads: [
      {
        path: "uploads/client-files/invoice.pdf",
        sha256: sha256("restored"),
        size: Buffer.byteLength("restored")
      }
    ],
    liveUploadsDir,
    stagingUploadsDir,
    timestamp: "20260520T120000Z"
  })

  await expect(
    readFile(path.join(liveUploadsDir, "client-files", "invoice.pdf"), "utf8")
  ).resolves.toBe("restored")
  await expect(pathExists(path.join(liveUploadsDir, "old", "stale.txt"))).resolves.toBe(false)
  await expect(pathExists(result.previousUploadsDir ?? "")).resolves.toBe(false)
})

async function buildArchive(
  options: {
    appVersion?: string
    databaseChecksum?: string
    headerVersion?: number
    manifestVersion?: number
  } = {}
): Promise<Buffer> {
  const databaseDump = Buffer.from("database dump")
  const upload = Buffer.from("upload content")
  const databaseChecksum = options.databaseChecksum ?? sha256(databaseDump)
  const checksums = Buffer.from(
    [
      `${databaseChecksum}  database/remit.dump`,
      `${sha256(upload)}  uploads/client-files/upload.txt`
    ].join("\n") + "\n",
    "utf8"
  )
  const manifest = buildBackupManifest({
    appVersion: options.appVersion ?? "1.0.0",
    checksumsSha256: sha256Hex(checksums),
    components: {
      database: {
        size: databaseDump.length,
        sha256: databaseChecksum
      },
      uploads: {
        fileCount: 1,
        totalSize: upload.length
      }
    },
    createdAt: "2026-05-20T12:00:00.000Z",
    destination: "local",
    encryptionKey: key,
    schemaMigrationId: "0001_initial"
  })
  const manifestBuffer = serializeBackupManifest({
    ...manifest,
    archiveFormatVersion: (options.manifestVersion ?? manifest.archiveFormatVersion) as 1
  })
  const tar = Buffer.concat([
    tarFile("manifest.json", manifestBuffer),
    tarFile("checksums.sha256", checksums),
    tarFile("database/remit.dump", databaseDump),
    tarFile("uploads/client-files/upload.txt", upload),
    Buffer.alloc(1024)
  ])
  const iv = Buffer.from("123456789012")
  const header = Buffer.alloc(ARCHIVE_HEADER_LENGTH)
  writeArchiveHeader(header, {
    archiveFormatVersion: options.headerVersion,
    iv,
    keyFingerprint: computeKeyFingerprint(key)
  })
  const encrypted = await encryptBuffer(gzipSync(tar), iv)

  expect(readArchiveHeader(header).keyFingerprint).toBe(computeKeyFingerprint(key))

  return Buffer.concat([header, encrypted.ciphertext, encrypted.authTag])
}

async function encryptBuffer(
  plaintext: Buffer,
  iv: Buffer
): Promise<{ authTag: Buffer; ciphertext: Buffer }> {
  const encryption = encryptStream(key, iv)
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
  const field = `${value.toString(8).padStart(length - 2, "0")}\0 `
  buffer.write(field, offset, length, "ascii")
}

function paddingFor(size: number): number {
  const remainder = size % 512

  return remainder === 0 ? 0 : 512 - remainder
}

async function makeTempDirectory(): Promise<string> {
  const tempRoot = await import("node:fs/promises").then((fs) =>
    fs.mkdtemp(path.join(os.tmpdir(), "remit-restore-"))
  )
  tempRoots.push(tempRoot)

  return tempRoot
}

async function pathExists(filePath: string): Promise<boolean> {
  if (!filePath) return false

  try {
    await stat(filePath)

    return true
  } catch (error) {
    return !(
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    )
  }
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex")
}
