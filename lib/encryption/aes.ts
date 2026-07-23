import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_BYTE_LENGTH = 12
const AUTH_TAG_BYTE_LENGTH = 16

function decodeHexComponent(value: string, expectedByteLength: number, label: string): Buffer {
  if (!/^[\da-f]+$/i.test(value) || value.length !== expectedByteLength * 2) {
    throw new Error(`Invalid ${label} in encrypted payload`)
  }

  return Buffer.from(value, "hex")
}

// The `iv:ciphertext:authTag` hex envelope is the on-disk format of every encrypted column, so it
// is a storage contract rather than an implementation detail: changing the separator, the encoding
// or the component order makes every already-stored value unreadable, including by the rotation
// path in `scripts/core/keyRotation/`. A fresh random IV per call is mandatory — GCM loses all
// confidentiality guarantees if an IV is ever reused under the same key.
export function encryptString(plaintext: string, key: Uint8Array): string {
  const iv = randomBytes(IV_BYTE_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${authTag.toString("hex")}`
}

export function decryptString(payload: string, key: Uint8Array): string {
  const parts = payload.split(":")

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format")
  }

  const [ivHex, ciphertextHex, authTagHex] = parts

  const iv = decodeHexComponent(ivHex, IV_BYTE_LENGTH, "IV")
  // Ciphertext has no fixed length, so it passes its own: that still rejects an odd number of hex
  // characters (`length / 2 * 2` no longer equals `length`) on top of the charset check.
  const ciphertext = decodeHexComponent(ciphertextHex, ciphertextHex.length / 2, "ciphertext")
  const authTag = decodeHexComponent(authTagHex, AUTH_TAG_BYTE_LENGTH, "auth tag")
  const decipher = createDecipheriv(ALGORITHM, key, iv)

  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}
