import { createHash, timingSafeEqual } from "node:crypto"
import { once } from "node:events"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, rm, stat } from "node:fs/promises"
import path from "node:path"
import { type Writable } from "node:stream"
import { finished } from "node:stream/promises"
import { createGunzip } from "node:zlib"

import {
  ARCHIVE_HEADER_LENGTH,
  AUTH_TAG_LENGTH,
  decryptStream,
  type HeaderDescriptor
} from "../archive/header"
import {
  TAR_BLOCK_SIZE,
  isZeroBlock,
  paddingFor,
  parseTarHeader,
  type TarEntry
} from "../archive/tar"
import { AsyncBufferReader, TarTruncatedError } from "../utils/asyncBufferReader"
import { isSameOrChildPath } from "../utils/fs"
import { sha256Hex } from "../utils/hash"

import { RestoreCliError } from "./errors"
import { readAuthTag } from "./header"
import {
  assertArchiveAppVersionAllowed,
  restoreManifestSchema,
  type RestoreManifest
} from "./manifestSchema"

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
  // Reads only the ciphertext body: the plaintext header occupies the first `ARCHIVE_HEADER_LENGTH`
  // bytes and the GCM auth tag the last `AUTH_TAG_LENGTH`, and neither may be fed to the decipher.
  // `end` is inclusive in createReadStream, hence the extra -1.
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

    if (error instanceof RestoreCliError) throw error
    if (error instanceof TarTruncatedError) {
      throw new RestoreCliError(
        "Refusing restore: archive ended before the tar entry was complete.",
        "tar-truncated"
      )
    }

    throw new RestoreCliError(
      "Refusing restore: archive failed integrity check. The file may be corrupted, truncated, or encrypted with different bytes.",
      "archive-integrity-check-failed"
    )
  }

  const verified = finalizeVerification(state)

  if (options.mode === "verify-only") await cleanupVerificationState(state)

  return verified
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

    const parsed = parseTarHeader(header)

    if (parsed.kind === "invalid-size") {
      throw new RestoreCliError(
        "Refusing restore: archive tar entry has an invalid size.",
        "tar-size-invalid"
      )
    }

    if (parsed.kind === "unsupported-type") {
      throw new RestoreCliError(
        `Refusing restore: archive entry ${parsed.name} is not a regular file.`,
        "tar-entry-type-unsupported"
      )
    }

    await onEntry(parsed.entry)

    const padding = paddingFor(parsed.entry.size)
    if (padding > 0) await reader.skipBytes(padding)
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

      if (output) await writeToStream(output, chunk)
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
  const lines = checksumBuffer
    .toString("utf8")
    .split(/\r?\n/)
    .filter((line) => line.length > 0)

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

async function cleanupVerificationState(state: VerificationState): Promise<void> {
  await Promise.all([
    state.workDir ? rm(state.workDir, { recursive: true, force: true }) : Promise.resolve(),
    state.uploadsStagingDir
      ? rm(state.uploadsStagingDir, { recursive: true, force: true })
      : Promise.resolve()
  ])
}

async function writeToStream(output: Writable, buffer: Buffer): Promise<void> {
  if (!output.write(buffer)) await once(output, "drain")
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
