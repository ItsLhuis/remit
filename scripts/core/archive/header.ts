import {
  createCipheriv,
  createDecipheriv,
  createHash,
  timingSafeEqual,
  type CipherGCM,
  type DecipherGCM
} from "node:crypto"

// The 64-byte plaintext header every `.remitbak` archive opens with, ahead of the AES-256-GCM
// ciphertext. Offsets are frozen: archives already written to operators' disks and object stores
// are read back by this same parser, so a field may only ever be added inside the reserved runs,
// and a layout change needs a new `ARCHIVE_FORMAT_VERSION` restore refuses rather than misreads.
//
//   0..10   magic "REMIT-BAK\0"
//   10..12  format version, big-endian uint16
//   12      encryption algorithm byte (0x01 = AES-256-GCM)
//   13..16  reserved, must be zero
//   16..28  GCM initialisation vector (12 bytes)
//   28..44  key fingerprint (16 bytes, see computeKeyFingerprint below)
//   44..64  reserved, must be zero
//
// The two reserved runs are verified on read, not skipped, so a corrupt or foreign file is rejected
// at the header instead of failing later as an authentication error nobody can diagnose.
export const ARCHIVE_FORMAT_VERSION = 1
export const ARCHIVE_HEADER_LENGTH = 64
export const AUTH_TAG_LENGTH = 16
export const ENCRYPTION_ALGORITHM_BYTE = 0x01
export const ENCRYPTION_ALGORITHM_NAME = "AES-256-GCM"
export const HEADER_MAGIC = Buffer.from("REMIT-BAK\0", "ascii")
export const IV_LENGTH = 12
export const KEY_FINGERPRINT_LENGTH = 16

export type HeaderDescriptor = {
  archiveFormatVersion: number
  encryptionAlgorithm: typeof ENCRYPTION_ALGORITHM_NAME
  iv: Buffer
  keyFingerprint: string
}

export type WriteArchiveHeaderOptions = {
  archiveFormatVersion?: number
  iv: Buffer
  keyFingerprint: string
}

export type EncryptStreamResult = {
  stream: CipherGCM
  getAuthTag: () => Buffer
}

export type ArchiveKeyState = "new-key" | "old-key" | "unknown"

export function writeArchiveHeader(buf: Buffer, opts: WriteArchiveHeaderOptions): void {
  if (buf.length !== ARCHIVE_HEADER_LENGTH) {
    throw new Error(`Archive header buffer must be ${ARCHIVE_HEADER_LENGTH} bytes.`)
  }

  if (opts.iv.length !== IV_LENGTH) {
    throw new Error(`Archive IV must be ${IV_LENGTH} bytes.`)
  }

  const fingerprint = Buffer.from(opts.keyFingerprint, "hex")

  if (fingerprint.length !== KEY_FINGERPRINT_LENGTH) {
    throw new Error(`Archive key fingerprint must be ${KEY_FINGERPRINT_LENGTH} bytes.`)
  }

  buf.fill(0)
  HEADER_MAGIC.copy(buf, 0)
  buf.writeUInt16BE(opts.archiveFormatVersion ?? ARCHIVE_FORMAT_VERSION, 10)
  buf.writeUInt8(ENCRYPTION_ALGORITHM_BYTE, 12)
  opts.iv.copy(buf, 16)
  fingerprint.copy(buf, 28)
}

export function readArchiveHeader(buf: Buffer): HeaderDescriptor {
  if (buf.length !== ARCHIVE_HEADER_LENGTH) {
    throw new Error(`Archive header must be ${ARCHIVE_HEADER_LENGTH} bytes.`)
  }

  if (!buf.subarray(0, HEADER_MAGIC.length).equals(HEADER_MAGIC)) {
    throw new Error("Archive header magic is invalid.")
  }

  if (buf.readUInt8(12) !== ENCRYPTION_ALGORITHM_BYTE) {
    throw new Error("Archive encryption algorithm is unsupported.")
  }

  if (!buf.subarray(13, 16).equals(Buffer.alloc(3))) {
    throw new Error("Archive header reserved bytes are invalid.")
  }

  if (!buf.subarray(44, 64).equals(Buffer.alloc(20))) {
    throw new Error("Archive header reserved bytes are invalid.")
  }

  return {
    archiveFormatVersion: buf.readUInt16BE(10),
    encryptionAlgorithm: ENCRYPTION_ALGORITHM_NAME,
    iv: Buffer.from(buf.subarray(16, 28)),
    keyFingerprint: buf.subarray(28, 44).toString("hex")
  }
}

export function computeKeyFingerprint(key: Buffer): string {
  return createHash("sha256")
    .update(key)
    .digest()
    .subarray(0, KEY_FINGERPRINT_LENGTH)
    .toString("hex")
}

export function encryptStream(key: Buffer, iv: Buffer): EncryptStreamResult {
  validateKeyAndIv(key, iv)

  const stream = createCipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH })

  return {
    stream,
    getAuthTag: () => stream.getAuthTag()
  }
}

export function decryptStream(key: Buffer, iv: Buffer, authTag: Buffer): DecipherGCM {
  validateKeyAndIv(key, iv)

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Archive auth tag must be ${AUTH_TAG_LENGTH} bytes.`)
  }

  const stream = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH })
  stream.setAuthTag(authTag)

  return stream
}

export function readArchiveKeyState(input: {
  archive: Buffer
  newKey: Buffer
  oldKey: Buffer
}): ArchiveKeyState {
  const header = readArchiveHeader(input.archive.subarray(0, ARCHIVE_HEADER_LENGTH))
  const headerFingerprint = Buffer.from(header.keyFingerprint, "hex")
  const oldFingerprint = Buffer.from(computeKeyFingerprint(input.oldKey), "hex")
  const newFingerprint = Buffer.from(computeKeyFingerprint(input.newKey), "hex")

  if (
    headerFingerprint.length === oldFingerprint.length &&
    timingSafeEqual(headerFingerprint, oldFingerprint)
  ) {
    return "old-key"
  }

  if (
    headerFingerprint.length === newFingerprint.length &&
    timingSafeEqual(headerFingerprint, newFingerprint)
  ) {
    return "new-key"
  }

  return "unknown"
}

function validateKeyAndIv(key: Buffer, iv: Buffer): void {
  if (key.length !== 32) throw new Error("Archive encryption key must be 32 bytes.")

  if (iv.length !== IV_LENGTH) throw new Error(`Archive IV must be ${IV_LENGTH} bytes.`)
}
