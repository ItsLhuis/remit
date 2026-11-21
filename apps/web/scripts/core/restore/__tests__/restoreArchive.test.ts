import { createHash } from "node:crypto"
import { readFile, rm, stat, writeFile } from "node:fs/promises"
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
    const archive = await buildArchive({ headerVersion: 3 })
    await writeFile(archivePath, archive)

    await expect(readAndValidateRestoreHeader(archivePath, key)).rejects.toThrow(
      "archive format version 3 is newer"
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
  const objectsStagingDir = path.join(tempRoot, "objects-staging")
  await writeFile(archivePath, await buildArchive())
  const header = await readAndValidateRestoreHeader(archivePath, key)

  const verified = await verifyArchivePayload({
    archivePath,
    currentAppVersion: "1.0.0",
    encryptionKey: key,
    header,
    mode: "verify-only",
    objectsStagingDir,
    workDir
  })

  await expect(pathExists(workDir)).resolves.toBe(false)
  await expect(pathExists(objectsStagingDir)).resolves.toBe(false)
  expect(verified.databaseDumpPath).toBeNull()
  expect(verified.objectsStagingDir).toBeNull()
  expect(verified.objects.map((object) => object.stagedPath)).toEqual([null])
})

test("stages keys that would collide as file paths, so an archive the backup accepted always restores", async () => {
  const tempRoot = await makeTempDirectory()
  const archivePath = path.join(tempRoot, "colliding.remitbak")
  await writeFile(
    archivePath,
    await buildArchive({
      objects: [
        { path: "objects/documents/a", body: "file named a" },
        { path: "objects/documents/a/b", body: "file under a" },
        { path: "objects/documents/Logo.png", body: "upper" },
        { path: "objects/documents/logo.png", body: "lower" }
      ]
    })
  )
  const header = await readAndValidateRestoreHeader(archivePath, key)

  const verified = await verifyArchivePayload({
    archivePath,
    currentAppVersion: "1.0.0",
    encryptionKey: key,
    header,
    mode: "stage",
    objectsStagingDir: path.join(tempRoot, "objects-staging"),
    workDir: path.join(tempRoot, "work")
  })

  const staged = await Promise.all(
    verified.objects.map(async (object) => [
      object.key,
      await readFile(object.stagedPath ?? "", "utf8")
    ])
  )

  expect(staged).toEqual([
    ["a", "file named a"],
    ["a/b", "file under a"],
    ["Logo.png", "upper"],
    ["logo.png", "lower"]
  ])
})

test("stages a version 2 archive's files with their bucket role, key and content type", async () => {
  const tempRoot = await makeTempDirectory()
  const archivePath = path.join(tempRoot, "valid.remitbak")
  const objectsStagingDir = path.join(tempRoot, "objects-staging")
  await writeFile(archivePath, await buildArchive())
  const header = await readAndValidateRestoreHeader(archivePath, key)

  const verified = await verifyArchivePayload({
    archivePath,
    currentAppVersion: "1.0.0",
    encryptionKey: key,
    header,
    mode: "stage",
    objectsStagingDir,
    workDir: path.join(tempRoot, "work")
  })

  expect(verified.objects).toEqual([
    expect.objectContaining({
      role: "documents",
      key: "attachments/upload.txt",
      contentType: "text/plain",
      sha256: sha256("upload content")
    })
  ])
  await expect(readFile(verified.objects[0]?.stagedPath ?? "", "utf8")).resolves.toBe(
    "upload content"
  )
})

// `headerVersion` is what the plaintext header claims, which a refusal test sets to one this build
// does not read.
async function buildArchive(
  options: {
    appVersion?: string
    databaseChecksum?: string
    headerVersion?: number
    // Entries of the documents bucket; one attachment when a test does not care which.
    objects?: Array<{ path: string; body: string }>
  } = {}
): Promise<Buffer> {
  const databaseDump = Buffer.from("database dump")
  const objects = (
    options.objects ?? [
      { path: "objects/documents/attachments/upload.txt", body: "upload content" }
    ]
  ).map((object) => ({ path: object.path, body: Buffer.from(object.body) }))
  const databaseChecksum = options.databaseChecksum ?? sha256(databaseDump)
  const checksums = Buffer.from(
    [
      `${databaseChecksum}  database/remit.dump`,
      ...objects.map((object) => `${sha256(object.body)}  ${object.path}`)
    ].join("\n") + "\n",
    "utf8"
  )
  const manifest = buildBackupManifest({
    appVersion: options.appVersion ?? "1.0.0",
    checksumsSha256: sha256Hex(checksums),
    components: {
      database: { size: databaseDump.length, sha256: databaseChecksum },
      objects: {
        buckets: {
          public: { fileCount: 0, totalSize: 0 },
          documents: {
            fileCount: objects.length,
            totalSize: objects.reduce((sum, object) => sum + object.body.length, 0)
          }
        },
        contentTypes: Object.fromEntries(objects.map((object) => [object.path, "text/plain"]))
      }
    },
    createdAt: "2026-05-20T12:00:00.000Z",
    destination: "local",
    encryptionKey: key,
    schemaMigrationId: "0001_initial"
  })
  const manifestBuffer = serializeBackupManifest(manifest)
  const tar = Buffer.concat([
    tarFile("manifest.json", manifestBuffer),
    tarFile("checksums.sha256", checksums),
    tarFile("database/remit.dump", databaseDump),
    ...objects.map((object) => tarFile(object.path, object.body)),
    Buffer.alloc(1024)
  ])
  const iv = Buffer.from("123456789012")
  const header = Buffer.alloc(ARCHIVE_HEADER_LENGTH)
  writeArchiveHeader(header, {
    archiveFormatVersion: options.headerVersion ?? 2,
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
