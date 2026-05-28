import { randomBytes } from "node:crypto"

import { gunzipSync, gzipSync } from "node:zlib"

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

import { parseTarEntries, writeTarEntries, type TarBufferEntry } from "./tar"

export function reencryptArchiveBuffer(input: {
  archive: Buffer
  newKey: Buffer
  oldKey: Buffer
}): Buffer {
  if (input.archive.length < ARCHIVE_HEADER_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Archive is too small to contain a complete encrypted backup.")
  }

  const keyState = readArchiveKeyState(input)

  if (keyState === "new-key") return input.archive

  if (keyState !== "old-key")
    throw new Error("Archive was not encrypted with the provided old key.")

  const oldHeader = readArchiveHeader(input.archive.subarray(0, ARCHIVE_HEADER_LENGTH))
  const oldAuthTag = input.archive.subarray(input.archive.length - AUTH_TAG_LENGTH)
  const oldCiphertext = input.archive.subarray(
    ARCHIVE_HEADER_LENGTH,
    input.archive.length - AUTH_TAG_LENGTH
  )
  const compressedTar = decryptBuffer(oldCiphertext, input.oldKey, oldHeader.iv, oldAuthTag)
  const entries = parseTarEntries(gunzipSync(compressedTar))
  const rewrittenEntries = rewriteManifestFingerprint(entries, computeKeyFingerprint(input.newKey))
  const newIv = randomBytes(IV_LENGTH)
  const newHeader = Buffer.alloc(ARCHIVE_HEADER_LENGTH)
  writeArchiveHeader(newHeader, {
    archiveFormatVersion: oldHeader.archiveFormatVersion,
    iv: newIv,
    keyFingerprint: computeKeyFingerprint(input.newKey)
  })
  const encrypted = encryptBuffer(gzipSync(writeTarEntries(rewrittenEntries)), input.newKey, newIv)

  return Buffer.concat([newHeader, encrypted.ciphertext, encrypted.authTag])
}

function decryptBuffer(ciphertext: Buffer, key: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const decipher = decryptStream(key, iv, authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

function encryptBuffer(
  plaintext: Buffer,
  key: Buffer,
  iv: Buffer
): { authTag: Buffer; ciphertext: Buffer } {
  const cipher = encryptStream(key, iv)
  const ciphertext = Buffer.concat([cipher.stream.update(plaintext), cipher.stream.final()])

  return { authTag: cipher.getAuthTag(), ciphertext }
}

function rewriteManifestFingerprint(
  entries: readonly TarBufferEntry[],
  keyFingerprint: string
): TarBufferEntry[] {
  const [manifestEntry, ...rest] = entries

  if (!manifestEntry || manifestEntry.name !== "manifest.json") {
    throw new Error("Archive manifest.json must be the first tar entry.")
  }

  const manifest = parseManifestJson(manifestEntry.content)
  const encryption = readJsonObject(manifest, "encryption")
  encryption.keyFingerprint = `sha256:${keyFingerprint}`

  return [
    {
      name: manifestEntry.name,
      content: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
    },
    ...rest
  ]
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
