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
  const ciphertext = decodeHexComponent(ciphertextHex, ciphertextHex.length / 2, "ciphertext")
  const authTag = decodeHexComponent(authTagHex, AUTH_TAG_BYTE_LENGTH, "auth tag")
  const decipher = createDecipheriv(ALGORITHM, key, iv)

  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}
