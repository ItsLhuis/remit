import { PassThrough } from "node:stream"

import { describe, expect, test } from "vitest"

import {
  ARCHIVE_FORMAT_VERSION,
  ARCHIVE_HEADER_LENGTH,
  ENCRYPTION_ALGORITHM_NAME,
  computeKeyFingerprint,
  decryptStream,
  encryptStream,
  readArchiveHeader,
  writeArchiveHeader
} from "../backup-archive"

describe("backup archive helpers", () => {
  test("round-trips the plaintext header when fields are valid", () => {
    const key = Buffer.from("a".repeat(32))
    const iv = Buffer.from("b".repeat(12))
    const header = Buffer.alloc(ARCHIVE_HEADER_LENGTH)

    writeArchiveHeader(header, { iv, keyFingerprint: computeKeyFingerprint(key) })

    const descriptor = readArchiveHeader(header)

    expect(descriptor).toEqual({
      archiveFormatVersion: ARCHIVE_FORMAT_VERSION,
      encryptionAlgorithm: ENCRYPTION_ALGORITHM_NAME,
      iv,
      keyFingerprint: computeKeyFingerprint(key)
    })
  })

  test("rejects invalid magic and reserved bytes", () => {
    const key = Buffer.from("a".repeat(32))
    const iv = Buffer.from("b".repeat(12))
    const header = Buffer.alloc(ARCHIVE_HEADER_LENGTH)

    writeArchiveHeader(header, { iv, keyFingerprint: computeKeyFingerprint(key) })
    header[13] = 1

    expect(() => readArchiveHeader(header)).toThrow("reserved bytes")

    header[13] = 0
    header[0] = 0

    expect(() => readArchiveHeader(header)).toThrow("magic")
  })

  test("round-trips AES-256-GCM stream encryption", async () => {
    const key = Buffer.from("c".repeat(32))
    const iv = Buffer.from("d".repeat(12))
    const plaintext = Buffer.from("encrypted backup payload")
    const encrypted = await collectEncryptedPayload(plaintext, key, iv)
    const decrypted = await collectStream(
      PassThrough.from(encrypted.ciphertext).pipe(decryptStream(key, iv, encrypted.authTag))
    )

    expect(decrypted).toEqual(plaintext)
  })
})

async function collectEncryptedPayload(
  plaintext: Buffer,
  key: Buffer,
  iv: Buffer
): Promise<{ authTag: Buffer; ciphertext: Buffer }> {
  const encryption = encryptStream(key, iv)
  const ciphertext = await collectStream(PassThrough.from(plaintext).pipe(encryption.stream))

  return {
    authTag: encryption.getAuthTag(),
    ciphertext
  }
}

async function collectStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}
