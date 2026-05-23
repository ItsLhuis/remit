import { createHash, timingSafeEqual } from "node:crypto"

import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, open, readdir, rename, rm, stat } from "node:fs/promises"

import path from "node:path"
import { createGunzip } from "node:zlib"

import { once } from "node:events"

import type { Readable, Writable } from "node:stream"
import { finished } from "node:stream/promises"

import { z } from "zod"

import {
  ARCHIVE_HEADER_LENGTH,
  AUTH_TAG_LENGTH,
  ENCRYPTION_ALGORITHM_BYTE,
  HEADER_MAGIC,
  computeKeyFingerprint,
  decryptStream,
  readArchiveHeader,
  type HeaderDescriptor
} from "./backupArchive"
import { sha256Hex } from "./backupManifest"

export const SUPPORTED_ARCHIVE_VERSIONS = [1] as const

export type SupportedArchiveVersion = (typeof SUPPORTED_ARCHIVE_VERSIONS)[number]

export type RestoreManifest = z.infer<typeof restoreManifestSchema>

export type ChecksumDescriptor = {
  path: string
  sha256: string
  size: number
}

export type VerifiedArchive = {
  checksumsPathCount: number
  databaseDumpPath: string | null
  databaseSize: number
  header: HeaderDescriptor
  manifest: RestoreManifest
  uploads: ChecksumDescriptor[]
  uploadsStagingDir: string | null
}

export type VerifyArchiveMode = "stage" | "verify-only"

export type VerifyArchiveOptions = {
  archivePath: string
  currentAppVersion: string
  encryptionKey: Buffer
  header: HeaderDescriptor
  mode: VerifyArchiveMode
  uploadsStagingDir?: string
  workDir?: string
}

export type AtomicSwapResult = {
  previousUploadsDir: string | null
  restoredUploadsDir: string
}

export class RestoreCliError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly auditEligible: boolean = true
  ) {
    super(message)
  }
}

const TAR_BLOCK_SIZE = 512
const HEX_64 = /^[a-f0-9]{64}$/
const MANIFEST_FINGERPRINT = /^sha256:[a-f0-9]{32}$/
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

const restoreManifestSchema = z
  .object({
    archiveFormatVersion: z.number().int().positive(),
    appVersion: z.string().regex(SEMVER),
    createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
    createdBy: z.literal("remit:backup"),
    schemaMigrationId: z.string().min(1),
    encryption: z
      .object({
        algorithm: z.literal("AES-256-GCM"),
        keySource: z.literal("REMIT_ENCRYPTION_KEY"),
        keyFingerprint: z.string().regex(MANIFEST_FINGERPRINT)
      })
      .strict(),
    compression: z.literal("gzip"),
    components: z
      .object({
        database: z
          .object({
            format: z.literal("pg_dump-custom"),
            size: z.number().int().nonnegative(),
            sha256: z.string().regex(HEX_64)
          })
          .strict(),
        uploads: z
          .object({
            format: z.literal("tar-stream"),
            fileCount: z.number().int().nonnegative(),
            totalSize: z.number().int().nonnegative(),
            sha256Manifest: z.string().regex(HEX_64)
          })
          .strict()
      })
      .strict(),
    destination: z.enum(["local", "s3", "r2", "b2"])
  })
  .strict()

export async function readAndValidateRestoreHeader(
  archivePath: string,
  encryptionKey: Buffer
): Promise<HeaderDescriptor> {
  const headerBuffer = await readHeaderBuffer(archivePath)
  const header = parseHeaderWithRestoreMessages(headerBuffer)

  if (
    !SUPPORTED_ARCHIVE_VERSIONS.includes(header.archiveFormatVersion as SupportedArchiveVersion)
  ) {
    const maxSupportedVersion = Math.max(...SUPPORTED_ARCHIVE_VERSIONS)

    if (header.archiveFormatVersion > maxSupportedVersion) {
      throw new RestoreCliError(
        `Refusing restore: archive format version ${header.archiveFormatVersion} is newer than this build supports. Upgrade Remit to a build that supports archive format ${header.archiveFormatVersion} before restoring.`,
        "archive-version-unsupported",
        false
      )
    }

    throw new RestoreCliError(
      `Refusing restore: archive format version ${header.archiveFormatVersion} is not supported by this build. Choose an archive produced by a supported Remit release.`,
      "archive-version-unsupported",
      false
    )
  }

  const liveFingerprint = Buffer.from(computeKeyFingerprint(encryptionKey), "hex")
  const archiveFingerprint = Buffer.from(header.keyFingerprint, "hex")

  if (
    archiveFingerprint.length !== liveFingerprint.length ||
    !timingSafeEqual(archiveFingerprint, liveFingerprint)
  ) {
    throw new RestoreCliError(
      "Refusing restore: this archive was encrypted with a different REMIT_ENCRYPTION_KEY. Start the instance with the original encryption key or choose a backup created with the current key.",
      "key-fingerprint-mismatch",
      false
    )
  }

  return header
}

export async function verifyArchivePayload(
  options: VerifyArchiveOptions
): Promise<VerifiedArchive> {
  const stats = await stat(options.archivePath)

  if (stats.size < ARCHIVE_HEADER_LENGTH + AUTH_TAG_LENGTH) {
    throw new RestoreCliError(
      "Refusing restore: archive is too small to contain a complete encrypted backup.",
      "archive-too-small"
    )
  }

  const authTag = await readAuthTag(options.archivePath, stats.size)
  const decrypt = decryptStream(options.encryptionKey, options.header.iv, authTag)
  const source = createReadStream(options.archivePath, {
    end: stats.size - AUTH_TAG_LENGTH - 1,
    start: ARCHIVE_HEADER_LENGTH
  })
  const gunzip = createGunzip()

  source.on("error", (error) => decrypt.destroy(error))
  decrypt.on("error", (error) => gunzip.destroy(error))
  source.pipe(decrypt).pipe(gunzip)

  const reader = new AsyncBufferReader(gunzip)
  const state = createVerificationState(options)

  try {
    await readTarStream(reader, async (entry) => {
      await processTarEntry(entry, reader, state)
    })
    await reader.drain()
  } catch (error) {
    await cleanupVerificationState(state)

    if (error instanceof RestoreCliError) {
      throw error
    }

    throw new RestoreCliError(
      "Refusing restore: archive failed integrity check. The file may be corrupted, truncated, or encrypted with different bytes.",
      "archive-integrity-check-failed"
    )
  }

  const verified = finalizeVerification(state)

  if (options.mode === "verify-only") {
    await cleanupVerificationState(state)
  }

  return verified
}

export async function applyUploadsAtomicSwap(input: {
  expectedUploads: ChecksumDescriptor[]
  liveUploadsDir: string
  stagingUploadsDir: string
  timestamp: string
}): Promise<AtomicSwapResult> {
  const liveUploadsDir = path.resolve(input.liveUploadsDir)
  const stagingUploadsDir = path.resolve(input.stagingUploadsDir)
  const parentDir = path.dirname(liveUploadsDir)
  const liveName = path.basename(liveUploadsDir)
  const previousUploadsDir = path.join(parentDir, `.${liveName}.previous-${input.timestamp}`)
  let liveMoved = false
  let stagingMoved = false

  await verifyUploadsDirectory(stagingUploadsDir, input.expectedUploads)
  await mkdir(parentDir, { recursive: true })
  await rm(previousUploadsDir, { recursive: true, force: true })

  try {
    if (await pathExists(liveUploadsDir)) {
      await rename(liveUploadsDir, previousUploadsDir)
      liveMoved = true
    }

    await rename(stagingUploadsDir, liveUploadsDir)
    stagingMoved = true

    await verifyUploadsDirectory(liveUploadsDir, input.expectedUploads)

    if (liveMoved) {
      await rm(previousUploadsDir, { recursive: true, force: true })
    }

    return {
      previousUploadsDir: liveMoved ? previousUploadsDir : null,
      restoredUploadsDir: liveUploadsDir
    }
  } catch (error) {
    // Roll back to the original layout. Undoing the staging move is best-effort: its failure must
    // never prevent the authoritative step below, which restores the operator's previous uploads
    // from previousUploadsDir back to liveUploadsDir.
    if (stagingMoved) {
      try {
        await rename(liveUploadsDir, stagingUploadsDir)
      } catch {
        await rm(liveUploadsDir, { recursive: true, force: true }).catch(() => undefined)
      }
    }

    if (liveMoved && (await pathExists(previousUploadsDir))) {
      await rename(previousUploadsDir, liveUploadsDir)
    }

    throw error
  }
}

export async function verifyUploadsDirectory(
  rootDir: string,
  expectedUploads: ChecksumDescriptor[]
): Promise<void> {
  const expected = new Map(expectedUploads.map((upload) => [upload.path, upload]))
  const actualFiles = await listFiles(rootDir)

  if (actualFiles.length !== expected.size) {
    throw new RestoreCliError(
      "Uploads verification failed after restore. The previous uploads directory has been restored.",
      "uploads-verification-failed"
    )
  }

  for (const filePath of actualFiles) {
    const relativePath = path.relative(rootDir, filePath).split(path.sep).join("/")
    const descriptor = expected.get(`uploads/${relativePath}`)

    if (!descriptor) {
      throw new RestoreCliError(
        "Uploads verification failed after restore. The previous uploads directory has been restored.",
        "uploads-verification-failed"
      )
    }

    const [fileStats, sha256] = await Promise.all([stat(filePath), hashFile(filePath)])

    if (fileStats.size !== descriptor.size || sha256 !== descriptor.sha256) {
      throw new RestoreCliError(
        "Uploads verification failed after restore. The previous uploads directory has been restored.",
        "uploads-verification-failed"
      )
    }
  }
}

export function getDatabaseName(databaseUrl: string): string {
  const parsed = new URL(databaseUrl)
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""))

  if (!databaseName) {
    throw new RestoreCliError(
      "Refusing restore: DATABASE_URL does not include a database name.",
      "database-name-missing"
    )
  }

  return databaseName
}

export function isArchiveAppVersionNewer(archiveVersion: string, currentVersion: string): boolean {
  return compareSemver(archiveVersion, currentVersion) > 0
}

export function redactRestoreReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  return message
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://[redacted]@")
    .replace(/(REMIT_ENCRYPTION_KEY=)[^\s]+/g, "$1[redacted]")
    .replace(/(iv|tag|authTag|key|fingerprint)=?[A-Fa-f0-9+/=]{16,}/g, "$1=[redacted]")
    .replace(
      /\b(accessKey|secretKey|access_key|secret_key)\b\s*[=:]\s*[^\s&]+/gi,
      "[redacted credential]"
    )
    .replace(/X-Amz-(Credential|Signature|Security-Token)=[^&\s]+/g, "X-Amz-$1=[redacted]")
    .replace(/\s+at\s+.+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500)
}

function parseHeaderWithRestoreMessages(headerBuffer: Buffer): HeaderDescriptor {
  try {
    return readArchiveHeader(headerBuffer)
  } catch {
    if (!headerBuffer.subarray(0, HEADER_MAGIC.length).equals(HEADER_MAGIC)) {
      throw new RestoreCliError(
        "Refusing restore: archive is not a Remit backup file. Choose a .remitbak archive created by pnpm remit:backup.",
        "archive-magic-invalid",
        false
      )
    }

    if (headerBuffer.readUInt8(12) !== ENCRYPTION_ALGORITHM_BYTE) {
      throw new RestoreCliError(
        "Refusing restore: archive encryption algorithm is not supported. Choose an AES-256-GCM .remitbak archive created by this Remit release.",
        "archive-algorithm-unsupported",
        false
      )
    }

    if (
      !headerBuffer.subarray(13, 16).equals(Buffer.alloc(3)) ||
      !headerBuffer.subarray(44, 64).equals(Buffer.alloc(20))
    ) {
      throw new RestoreCliError(
        "Refusing restore: archive header reserved bytes are non-zero. The archive format is invalid; create a fresh backup or restore from another archive.",
        "archive-reserved-bytes-invalid",
        false
      )
    }

    throw new RestoreCliError(
      "Refusing restore: archive header is invalid. Choose a .remitbak archive created by pnpm remit:backup.",
      "archive-header-invalid",
      false
    )
  }
}

async function readHeaderBuffer(archivePath: string): Promise<Buffer> {
  const file = await open(archivePath, "r")
  const buffer = Buffer.alloc(ARCHIVE_HEADER_LENGTH)

  try {
    const { bytesRead } = await file.read(buffer, 0, ARCHIVE_HEADER_LENGTH, 0)

    if (bytesRead !== ARCHIVE_HEADER_LENGTH) {
      throw new RestoreCliError(
        "Refusing restore: archive is too small to contain a Remit backup header.",
        "archive-header-too-small",
        false
      )
    }

    return buffer
  } finally {
    await file.close()
  }
}

async function readAuthTag(archivePath: string, fileSize: number): Promise<Buffer> {
  const file = await open(archivePath, "r")
  const buffer = Buffer.alloc(AUTH_TAG_LENGTH)

  try {
    const { bytesRead } = await file.read(buffer, 0, AUTH_TAG_LENGTH, fileSize - AUTH_TAG_LENGTH)

    if (bytesRead !== AUTH_TAG_LENGTH) {
      throw new RestoreCliError(
        "Refusing restore: archive is missing the AES-GCM authentication tag.",
        "archive-auth-tag-missing"
      )
    }

    return buffer
  } finally {
    await file.close()
  }
}

type VerificationState = {
  actualDatabase: ChecksumDescriptor | null
  actualUploads: ChecksumDescriptor[]
  checksums: Map<string, string> | null
  currentAppVersion: string
  databaseDumpPath: string | null
  entryIndex: number
  header: HeaderDescriptor
  manifest: RestoreManifest | null
  mode: VerifyArchiveMode
  seenPaths: Set<string>
  uploadsStagingDir: string | null
  workDir: string | null
}

function createVerificationState(options: VerifyArchiveOptions): VerificationState {
  return {
    actualDatabase: null,
    actualUploads: [],
    checksums: null,
    currentAppVersion: options.currentAppVersion,
    databaseDumpPath:
      options.mode === "stage" && options.workDir
        ? path.join(options.workDir, "database", "remit.dump")
        : null,
    entryIndex: 0,
    header: options.header,
    manifest: null,
    mode: options.mode,
    seenPaths: new Set(),
    uploadsStagingDir: options.mode === "stage" ? (options.uploadsStagingDir ?? null) : null,
    workDir: options.mode === "stage" ? (options.workDir ?? null) : null
  }
}

type TarEntry = {
  name: string
  size: number
  type: "directory" | "file"
}

async function readTarStream(
  reader: AsyncBufferReader,
  onEntry: (entry: TarEntry) => Promise<void>
): Promise<void> {
  while (true) {
    const header = await reader.readExactly(TAR_BLOCK_SIZE)

    if (!header) return

    if (isZeroBlock(header)) {
      const secondZeroBlock = await reader.readExactly(TAR_BLOCK_SIZE)

      if (secondZeroBlock && !isZeroBlock(secondZeroBlock)) {
        throw new RestoreCliError(
          "Refusing restore: archive tar stream has data after the end marker.",
          "tar-trailing-data"
        )
      }

      return
    }

    const entry = parseTarEntry(header)
    await onEntry(entry)

    const padding = paddingFor(entry.size)

    if (padding > 0) {
      await reader.skipBytes(padding)
    }
  }
}

async function processTarEntry(
  entry: TarEntry,
  reader: AsyncBufferReader,
  state: VerificationState
): Promise<void> {
  state.entryIndex += 1

  if (entry.type === "directory") {
    await reader.skipBytes(entry.size)
    return
  }

  if (state.entryIndex === 1) {
    if (entry.name !== "manifest.json") {
      throw new RestoreCliError(
        "Refusing restore: manifest.json must be the first entry in the archive.",
        "manifest-not-first"
      )
    }

    const manifestBuffer = await reader.readBuffer(entry.size)
    state.manifest = parseAndValidateManifest(manifestBuffer, state.header)

    assertArchiveAppVersionAllowed(state.manifest, state.currentAppVersion)

    return
  }

  if (state.entryIndex === 2) {
    if (entry.name !== "checksums.sha256") {
      throw new RestoreCliError(
        "Refusing restore: checksums.sha256 must be the second entry in the archive.",
        "checksums-not-second"
      )
    }

    const checksumBuffer = await reader.readBuffer(entry.size)
    state.checksums = parseChecksums(checksumBuffer)

    const manifest = requireManifest(state)
    const checksumsSha256 = sha256Hex(checksumBuffer)

    if (checksumsSha256 !== manifest.components.uploads.sha256Manifest) {
      throw new RestoreCliError(
        "Refusing restore: checksums.sha256 does not match the manifest checksum.",
        "checksums-manifest-mismatch"
      )
    }

    return
  }

  const manifest = requireManifest(state)
  const checksums = requireChecksums(state)

  validateArchivePath(entry.name)

  if (state.seenPaths.has(entry.name)) {
    throw new RestoreCliError(
      `Refusing restore: archive contains duplicate entry ${entry.name}.`,
      "tar-duplicate-entry"
    )
  }

  if (entry.name !== "database/remit.dump" && !entry.name.startsWith("uploads/")) {
    throw new RestoreCliError(
      `Refusing restore: archive contains unsupported entry ${entry.name}.`,
      "tar-unsupported-entry"
    )
  }

  const expectedSha256 = checksums.get(entry.name)

  if (!expectedSha256) {
    throw new RestoreCliError(
      `Refusing restore: archive entry ${entry.name} is missing from checksums.sha256.`,
      "checksum-entry-missing"
    )
  }

  const descriptor = await consumeVerifiedEntry(entry, reader, state, expectedSha256)

  state.seenPaths.add(entry.name)

  if (entry.name === "database/remit.dump") {
    state.actualDatabase = descriptor

    if (
      descriptor.sha256 !== manifest.components.database.sha256 ||
      descriptor.size !== manifest.components.database.size
    ) {
      throw new RestoreCliError(
        "Refusing restore: database/remit.dump does not match the manifest descriptor.",
        "database-manifest-mismatch"
      )
    }

    return
  }

  state.actualUploads.push(descriptor)
}

function parseAndValidateManifest(
  manifestBuffer: Buffer,
  header: HeaderDescriptor
): RestoreManifest {
  const parsedJson = parseManifestJson(manifestBuffer)
  const parsed = restoreManifestSchema.safeParse(parsedJson)

  if (!parsed.success) {
    throw new RestoreCliError(
      "Refusing restore: manifest.json does not match the Remit backup manifest schema.",
      "manifest-schema-invalid"
    )
  }

  const manifest = parsed.data

  if (manifest.archiveFormatVersion !== header.archiveFormatVersion) {
    throw new RestoreCliError(
      "Refusing restore: manifest archive format does not match the plaintext header. The archive may have been tampered with.",
      "manifest-header-version-mismatch"
    )
  }

  const headerFingerprint = Buffer.from(`sha256:${header.keyFingerprint}`)
  const manifestFingerprint = Buffer.from(manifest.encryption.keyFingerprint)

  if (
    headerFingerprint.length !== manifestFingerprint.length ||
    !timingSafeEqual(headerFingerprint, manifestFingerprint)
  ) {
    throw new RestoreCliError(
      "Refusing restore: manifest key fingerprint does not match the plaintext header. The archive may have been tampered with.",
      "manifest-header-fingerprint-mismatch"
    )
  }

  return manifest
}

export function assertArchiveAppVersionAllowed(
  manifest: RestoreManifest,
  currentAppVersion: string
): void {
  if (isArchiveAppVersionNewer(manifest.appVersion, currentAppVersion)) {
    throw new RestoreCliError(
      `Refusing restore: archive was created by app version ${manifest.appVersion}; upgrade the running build to >= ${manifest.appVersion} before restoring.`,
      "archive-app-version-newer"
    )
  }
}

async function consumeVerifiedEntry(
  entry: TarEntry,
  reader: AsyncBufferReader,
  state: VerificationState,
  expectedSha256: string
): Promise<ChecksumDescriptor> {
  const hash = createHash("sha256")
  let size = 0
  const output = await createEntryOutput(entry.name, state)

  try {
    await reader.drainBytes(entry.size, async (chunk) => {
      size += chunk.length
      hash.update(chunk)

      if (output) {
        await writeToStream(output, chunk)
      }
    })
  } finally {
    if (output) {
      output.end()
      await finished(output)
    }
  }

  const sha256 = hash.digest("hex")

  if (sha256 !== expectedSha256) {
    throw new RestoreCliError(
      `Refusing restore: checksum verification failed for ${entry.name}. Restore was not applied.`,
      "checksum-mismatch"
    )
  }

  return { path: entry.name, sha256, size }
}

async function createEntryOutput(
  archivePath: string,
  state: VerificationState
): Promise<Writable | null> {
  if (state.mode !== "stage") return null

  if (archivePath === "database/remit.dump") {
    if (!state.databaseDumpPath) {
      throw new RestoreCliError(
        "Refusing restore: database staging path was not configured.",
        "database-staging-missing"
      )
    }

    await mkdir(path.dirname(state.databaseDumpPath), { recursive: true })

    return createWriteStream(state.databaseDumpPath, { flags: "wx" })
  }

  if (!state.uploadsStagingDir) {
    throw new RestoreCliError(
      "Refusing restore: uploads staging path was not configured.",
      "uploads-staging-missing"
    )
  }

  const uploadPath = archivePath.slice("uploads/".length)

  if (!uploadPath) {
    throw new RestoreCliError(
      "Refusing restore: uploads archive entry is missing a file path.",
      "uploads-entry-invalid"
    )
  }

  const destination = path.resolve(state.uploadsStagingDir, uploadPath)

  if (!isSameOrChildPath(destination, state.uploadsStagingDir)) {
    throw new RestoreCliError(
      "Refusing restore: uploads archive entry escapes the staging directory.",
      "uploads-entry-invalid"
    )
  }

  await mkdir(path.dirname(destination), { recursive: true })

  return createWriteStream(destination, { flags: "wx" })
}

function finalizeVerification(state: VerificationState): VerifiedArchive {
  const manifest = requireManifest(state)
  const checksums = requireChecksums(state)

  if (!state.actualDatabase) {
    throw new RestoreCliError(
      "Refusing restore: archive is missing database/remit.dump.",
      "database-dump-missing"
    )
  }

  for (const checksumPath of checksums.keys()) {
    if (!state.seenPaths.has(checksumPath)) {
      throw new RestoreCliError(
        `Refusing restore: checksum entry ${checksumPath} does not have a matching archive file.`,
        "checksum-file-missing"
      )
    }
  }

  const uploadsTotalSize = state.actualUploads.reduce((sum, upload) => sum + upload.size, 0)

  if (
    state.actualUploads.length !== manifest.components.uploads.fileCount ||
    uploadsTotalSize !== manifest.components.uploads.totalSize
  ) {
    throw new RestoreCliError(
      "Refusing restore: uploads entries do not match the manifest descriptor.",
      "uploads-manifest-mismatch"
    )
  }

  return {
    checksumsPathCount: checksums.size,
    databaseDumpPath: state.databaseDumpPath,
    databaseSize: state.actualDatabase.size,
    header: state.header,
    manifest,
    uploads: state.actualUploads,
    uploadsStagingDir: state.uploadsStagingDir
  }
}

function parseManifestJson(manifestBuffer: Buffer): unknown {
  try {
    return JSON.parse(manifestBuffer.toString("utf8"))
  } catch {
    throw new RestoreCliError(
      "Refusing restore: manifest.json is not valid JSON.",
      "manifest-json-invalid"
    )
  }
}

function parseChecksums(checksumBuffer: Buffer): Map<string, string> {
  const checksums = new Map<string, string>()
  const content = checksumBuffer.toString("utf8")
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0)

  for (const line of lines) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line)

    if (!match) {
      throw new RestoreCliError(
        "Refusing restore: checksums.sha256 contains an invalid line.",
        "checksums-line-invalid"
      )
    }

    const [, sha256, checksumPath] = match
    validateArchivePath(checksumPath)

    if (checksums.has(checksumPath)) {
      throw new RestoreCliError(
        `Refusing restore: checksums.sha256 contains duplicate path ${checksumPath}.`,
        "checksums-duplicate-path"
      )
    }

    checksums.set(checksumPath, sha256)
  }

  if (!checksums.has("database/remit.dump")) {
    throw new RestoreCliError(
      "Refusing restore: checksums.sha256 is missing database/remit.dump.",
      "database-checksum-missing"
    )
  }

  return checksums
}

function validateArchivePath(archivePath: string): void {
  if (
    archivePath.length === 0 ||
    archivePath.includes("\\") ||
    archivePath.startsWith("/") ||
    archivePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new RestoreCliError(
      `Refusing restore: archive path ${archivePath || "[empty]"} is invalid.`,
      "archive-path-invalid"
    )
  }
}

function requireManifest(state: VerificationState): RestoreManifest {
  if (!state.manifest) {
    throw new RestoreCliError(
      "Refusing restore: manifest.json was not read before archive contents.",
      "manifest-missing"
    )
  }

  return state.manifest
}

function requireChecksums(state: VerificationState): Map<string, string> {
  if (!state.checksums) {
    throw new RestoreCliError(
      "Refusing restore: checksums.sha256 was not read before archive contents.",
      "checksums-missing"
    )
  }

  return state.checksums
}

function parseTarEntry(header: Buffer): TarEntry {
  const name = readTarString(header, 0, 100)
  const prefix = readTarString(header, 345, 155)
  const fullName = prefix ? `${prefix}/${name}` : name
  const size = Number.parseInt(readTarString(header, 124, 12).trim() || "0", 8)
  const typeFlag = header.subarray(156, 157).toString("ascii")

  if (!Number.isFinite(size) || size < 0) {
    throw new RestoreCliError(
      "Refusing restore: archive tar entry has an invalid size.",
      "tar-size-invalid"
    )
  }

  if (typeFlag === "5") {
    return { name: fullName, size, type: "directory" }
  }

  if (typeFlag !== "0" && typeFlag !== "\0") {
    throw new RestoreCliError(
      `Refusing restore: archive entry ${fullName} is not a regular file.`,
      "tar-entry-type-unsupported"
    )
  }

  return { name: fullName, size, type: "file" }
}

function readTarString(buffer: Buffer, offset: number, length: number): string {
  const field = buffer.subarray(offset, offset + length)
  const end = field.indexOf(0)

  return field.subarray(0, end === -1 ? field.length : end).toString("utf8")
}

function isZeroBlock(buffer: Buffer): boolean {
  return buffer.equals(Buffer.alloc(buffer.length))
}

function paddingFor(size: number): number {
  const remainder = size % TAR_BLOCK_SIZE

  return remainder === 0 ? 0 : TAR_BLOCK_SIZE - remainder
}

async function cleanupVerificationState(state: VerificationState): Promise<void> {
  await Promise.all([
    state.workDir ? rm(state.workDir, { recursive: true, force: true }) : Promise.resolve(),
    state.uploadsStagingDir
      ? rm(state.uploadsStagingDir, { recursive: true, force: true })
      : Promise.resolve()
  ])
}

async function writeToStream(output: Writable, buffer: Buffer): Promise<void> {
  if (!output.write(buffer)) {
    await once(output, "drain")
  }
}

async function listFiles(rootDir: string): Promise<string[]> {
  try {
    const stats = await stat(rootDir)

    if (!stats.isDirectory()) return []
  } catch (error) {
    if (isMissingPathError(error)) return []

    throw error
  }

  const entries = await readdir(rootDir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(rootDir, entry.name)

      if (entry.isDirectory()) {
        return await listFiles(absolutePath)
      }

      if (entry.isFile()) {
        return [absolutePath]
      }

      return []
    })
  )

  return files.flat().sort((a, b) => a.localeCompare(b))
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256")
  const input = createReadStream(filePath)

  for await (const chunk of input) {
    hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return hash.digest("hex")
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)

    return true
  } catch (error) {
    return !isMissingPathError(error)
  }
}

function isSameOrChildPath(value: string, parent: string): boolean {
  const relative = path.relative(parent, value)

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  )
}

function compareSemver(left: string, right: string): number {
  const leftVersion = parseSemver(left)
  const rightVersion = parseSemver(right)

  for (const key of ["major", "minor", "patch"] as const) {
    const diff = leftVersion[key] - rightVersion[key]

    if (diff !== 0) return Math.sign(diff)
  }

  if (leftVersion.prerelease === rightVersion.prerelease) return 0
  if (!leftVersion.prerelease) return 1
  if (!rightVersion.prerelease) return -1

  return leftVersion.prerelease.localeCompare(rightVersion.prerelease)
}

function parseSemver(value: string): {
  major: number
  minor: number
  patch: number
  prerelease: string
} {
  const match = SEMVER.exec(value)

  if (!match) {
    throw new RestoreCliError(
      `Refusing restore: app version ${value} is not a valid semantic version.`,
      "semver-invalid"
    )
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prerelease: match[4] ?? ""
  }
}

class AsyncBufferReader {
  private readonly iterator: AsyncIterator<Buffer>
  private readonly buffers: Buffer[] = []
  private bufferedLength = 0
  private ended = false

  constructor(input: Readable) {
    this.iterator = input[Symbol.asyncIterator]()
  }

  async readExactly(length: number): Promise<Buffer | null> {
    if (length === 0) return Buffer.alloc(0)

    await this.fill(length)

    if (this.bufferedLength === 0 && this.ended) return null

    if (this.bufferedLength < length) {
      throw new RestoreCliError(
        "Refusing restore: archive ended before the tar entry was complete.",
        "tar-truncated"
      )
    }

    return this.take(length)
  }

  async readBuffer(length: number): Promise<Buffer> {
    const buffer = await this.readExactly(length)

    if (!buffer) {
      throw new RestoreCliError(
        "Refusing restore: archive ended before the tar entry was complete.",
        "tar-truncated"
      )
    }

    return buffer
  }

  async drainBytes(length: number, onChunk: (chunk: Buffer) => Promise<void>): Promise<void> {
    let remaining = length

    while (remaining > 0) {
      if (this.bufferedLength === 0) {
        await this.fill(1)
      }

      if (this.bufferedLength === 0) {
        throw new RestoreCliError(
          "Refusing restore: archive ended before the tar entry was complete.",
          "tar-truncated"
        )
      }

      const chunk = this.take(Math.min(remaining, this.buffers[0]?.length ?? remaining))
      remaining -= chunk.length

      await onChunk(chunk)
    }
  }

  async skipBytes(length: number): Promise<void> {
    await this.drainBytes(length, async () => undefined)
  }

  async drain(): Promise<void> {
    while (!this.ended) {
      await this.fill(this.bufferedLength + 1)

      if (this.bufferedLength > 0) {
        this.take(this.bufferedLength)
      }
    }
  }

  private async fill(length: number): Promise<void> {
    while (this.bufferedLength < length && !this.ended) {
      const result = await this.iterator.next()

      if (result.done) {
        this.ended = true
        return
      }

      const buffer = Buffer.isBuffer(result.value) ? result.value : Buffer.from(result.value)

      if (buffer.length === 0) continue

      this.buffers.push(buffer)
      this.bufferedLength += buffer.length
    }
  }

  private take(length: number): Buffer {
    const chunks: Buffer[] = []
    let remaining = length

    while (remaining > 0) {
      const first = this.buffers[0]

      if (!first) break

      if (first.length <= remaining) {
        chunks.push(first)
        this.buffers.shift()
        this.bufferedLength -= first.length
        remaining -= first.length
        continue
      }

      chunks.push(first.subarray(0, remaining))
      this.buffers[0] = first.subarray(remaining)
      this.bufferedLength -= remaining
      remaining = 0
    }

    return Buffer.concat(chunks)
  }
}
