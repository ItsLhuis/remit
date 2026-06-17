import { PassThrough } from "node:stream"
import { gunzipSync, gzipSync } from "node:zlib"

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
} from "../header"
import { reencryptArchiveBuffer } from "../reencrypt"

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

  test("re-encrypts archive headers and manifest fingerprints with a new key", async () => {
    const oldKey = Buffer.from("a".repeat(32))
    const newKey = Buffer.from("b".repeat(32))
    const iv = Buffer.from("123456789012")
    const manifest = Buffer.from(
      JSON.stringify(
        {
          encryption: {
            keyFingerprint: `sha256:${computeKeyFingerprint(oldKey)}`
          }
        },
        null,
        2
      ),
      "utf8"
    )
    const tar = Buffer.concat([tarFile("manifest.json", manifest), Buffer.alloc(1024)])
    const header = Buffer.alloc(ARCHIVE_HEADER_LENGTH)
    writeArchiveHeader(header, { iv, keyFingerprint: computeKeyFingerprint(oldKey) })
    const encrypted = await collectEncryptedPayload(gzip(tar), oldKey, iv)
    const archive = Buffer.concat([header, encrypted.ciphertext, encrypted.authTag])

    const rotated = reencryptArchiveBuffer({ archive, newKey, oldKey })
    const rotatedHeader = readArchiveHeader(rotated.subarray(0, ARCHIVE_HEADER_LENGTH))
    const rotatedPayload = await collectStream(
      PassThrough.from(rotated.subarray(ARCHIVE_HEADER_LENGTH, -16)).pipe(
        decryptStream(newKey, rotatedHeader.iv, rotated.subarray(-16))
      )
    )
    const entries = parseTarEntries(gunzip(rotatedPayload))
    const rotatedManifest = JSON.parse(entries.get("manifest.json")?.toString("utf8") ?? "{}") as {
      encryption?: { keyFingerprint?: string }
    }

    expect(rotatedHeader.keyFingerprint).toBe(computeKeyFingerprint(newKey))
    expect(rotatedManifest.encryption?.keyFingerprint).toBe(
      `sha256:${computeKeyFingerprint(newKey)}`
    )
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

function gzip(value: Buffer): Buffer {
  return gzipSync(value)
}

function gunzip(value: Buffer): Buffer {
  return gunzipSync(value)
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
  Buffer.from(name, "utf8").copy(header, 0)
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

function writeOctal(buffer: Buffer, value: number, offset: number, length: number): void {
  buffer.write(`${value.toString(8).padStart(length - 2, "0")}\0 `, offset, length, "ascii")
}

function paddingFor(size: number): number {
  const remainder = size % 512

  return remainder === 0 ? 0 : 512 - remainder
}

function parseTarEntries(tar: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>()
  let offset = 0

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)

    if (header.equals(Buffer.alloc(512))) break

    const name = readTarString(header, 0, 100)
    const size = Number.parseInt(readTarString(header, 124, 12).trim(), 8)
    const contentStart = offset + 512
    const contentEnd = contentStart + size

    entries.set(name, Buffer.from(tar.subarray(contentStart, contentEnd)))

    offset = contentStart + Math.ceil(size / 512) * 512
  }

  return entries
}

function readTarString(buffer: Buffer, offset: number, length: number): string {
  const field = buffer.subarray(offset, offset + length)
  const end = field.indexOf(0)

  return field.subarray(0, end === -1 ? field.length : end).toString("utf8")
}
