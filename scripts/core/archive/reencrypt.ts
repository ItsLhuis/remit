import { randomBytes } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { appendFile, open, rm, writeFile } from "node:fs/promises"
import { Transform, type TransformCallback } from "node:stream"
import { pipeline } from "node:stream/promises"
import { createGunzip, createGzip } from "node:zlib"

import {
  ARCHIVE_HEADER_LENGTH,
  AUTH_TAG_LENGTH,
  IV_LENGTH,
  computeKeyFingerprint,
  decryptStream,
  encryptStream,
  readArchiveHeader,
  readArchiveKeyState,
  writeArchiveHeader
} from "./header"
import { buildTarHeader, paddingFor, parseTarHeader, TAR_BLOCK_SIZE } from "./tar"

// Far above any real manifest (a few hundred bytes plus one content-type line per stored file), and
// the bound on what the rewrite buffers before the archive's authentication tag has been checked.
const MAX_MANIFEST_SIZE = 64 * 1024 * 1024

export type ArchiveReencryption = "rewritten" | "already-current"

export type ReencryptArchiveFileInput = {
  sourcePath: string
  outputPath: string
  newKey: Buffer
  oldKey: Buffer
}

// Streams rather than reading the archive into memory: an archive carries every stored file
// (ADR-0046), so its size is the instance's, not the database's. Only the leading `manifest.json`
// entry changes — its key fingerprint — and every entry after it passes through byte for byte.
//
// An archive already on the new key is left alone and nothing is written, which is what makes a
// re-run over an already-rotated set a no-op: `keyRotation/archives.ts` writes an archive back, and
// files a re-encryption audit entry, only for `"rewritten"`.
export async function reencryptArchiveFile(
  input: ReencryptArchiveFileInput
): Promise<ArchiveReencryption> {
  const { header, authTag, size } = await readArchiveEnvelope(input.sourcePath)
  const keyState = readArchiveKeyState({
    archive: header,
    newKey: input.newKey,
    oldKey: input.oldKey
  })

  if (keyState === "new-key") return "already-current"

  if (keyState !== "old-key") {
    throw new Error("Archive was not encrypted with the provided old key.")
  }

  const oldHeader = readArchiveHeader(header)
  const newIv = randomBytes(IV_LENGTH)
  const newHeader = Buffer.alloc(ARCHIVE_HEADER_LENGTH)
  writeArchiveHeader(newHeader, {
    archiveFormatVersion: oldHeader.archiveFormatVersion,
    iv: newIv,
    keyFingerprint: computeKeyFingerprint(input.newKey)
  })
  const encryption = encryptStream(input.newKey, newIv)

  try {
    // GCM releases plaintext before `final()` checks the tag, so a tampered archive is only known to
    // be one at the end; the output is discarded then, and never replaces anything before this
    // resolves.
    await writeFile(input.outputPath, newHeader, { flag: "wx" })
    await pipeline(
      createReadStream(input.sourcePath, {
        start: ARCHIVE_HEADER_LENGTH,
        end: size - AUTH_TAG_LENGTH - 1
      }),
      decryptStream(input.oldKey, oldHeader.iv, authTag),
      createGunzip(),
      new LeadingManifestRewrite(computeKeyFingerprint(input.newKey)),
      createGzip(),
      encryption.stream,
      createWriteStream(input.outputPath, { flags: "a" })
    )
    await appendFile(input.outputPath, encryption.getAuthTag())
  } catch (error) {
    await rm(input.outputPath, { force: true })

    throw error
  }

  return "rewritten"
}

async function readArchiveEnvelope(
  archivePath: string
): Promise<{ header: Buffer; authTag: Buffer; size: number }> {
  const file = await open(archivePath, "r")

  try {
    const { size } = await file.stat()

    if (size < ARCHIVE_HEADER_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Archive is too small to contain a complete encrypted backup.")
    }

    const header = Buffer.alloc(ARCHIVE_HEADER_LENGTH)
    const authTag = Buffer.alloc(AUTH_TAG_LENGTH)

    await file.read(header, 0, ARCHIVE_HEADER_LENGTH, 0)
    await file.read(authTag, 0, AUTH_TAG_LENGTH, size - AUTH_TAG_LENGTH)

    return { header, authTag, size }
  } finally {
    await file.close()
  }
}

// Buffers the tar stream only until the leading `manifest.json` entry is complete, replaces it, then
// passes every later chunk through untouched.
class LeadingManifestRewrite extends Transform {
  private pending = Buffer.alloc(0)
  private rewritten = false

  constructor(private readonly keyFingerprint: string) {
    super()
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.rewritten) {
      callback(null, chunk)

      return
    }

    try {
      this.pending = Buffer.concat([this.pending, chunk])

      const manifest = readLeadingManifest(this.pending)

      if (!manifest) {
        callback()

        return
      }

      const content = rewriteManifestFingerprint(manifest.content, this.keyFingerprint)

      this.push(buildTarHeader({ name: "manifest.json", size: content.length }))
      this.push(content)
      this.push(Buffer.alloc(paddingFor(content.length)))

      const rest = this.pending.subarray(manifest.entryLength)

      this.pending = Buffer.alloc(0)
      this.rewritten = true

      callback(null, rest.length > 0 ? rest : undefined)
    } catch (error) {
      callback(error as Error)
    }
  }

  override _flush(callback: TransformCallback): void {
    callback(
      this.rewritten ? null : new Error("Archive manifest.json must be the first tar entry.")
    )
  }
}

function readLeadingManifest(tar: Buffer): { content: Buffer; entryLength: number } | null {
  if (tar.length < TAR_BLOCK_SIZE) return null

  const header = parseTarHeader(tar.subarray(0, TAR_BLOCK_SIZE))

  if (header.kind !== "entry" || header.entry.name !== "manifest.json") {
    throw new Error("Archive manifest.json must be the first tar entry.")
  }

  if (header.entry.size > MAX_MANIFEST_SIZE) {
    throw new Error("Archive manifest.json is larger than any backup writes.")
  }

  const entryLength = TAR_BLOCK_SIZE + header.entry.size + paddingFor(header.entry.size)

  if (tar.length < entryLength) return null

  return {
    content: tar.subarray(TAR_BLOCK_SIZE, TAR_BLOCK_SIZE + header.entry.size),
    entryLength
  }
}

function rewriteManifestFingerprint(content: Buffer, keyFingerprint: string): Buffer {
  const manifest = parseManifestJson(content)
  const encryption = readJsonObject(manifest, "encryption")
  encryption.keyFingerprint = `sha256:${keyFingerprint}`

  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
}

function parseManifestJson(content: Buffer): Record<string, unknown> {
  const parsed = JSON.parse(content.toString("utf8")) as unknown

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Archive manifest.json must contain a JSON object.")
  }

  return parsed as Record<string, unknown>
}

function readJsonObject(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = parent[key]

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Archive manifest.json is missing object field ${key}.`)
  }

  return value as Record<string, unknown>
}
