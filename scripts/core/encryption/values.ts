import { decryptString, encryptString } from "@/lib/encryption/aes"

export function decryptValue(value: string, key: Buffer): string {
  return decryptString(value, key)
}

export function encryptValue(plaintext: string, key: Buffer): string {
  return encryptString(plaintext, key)
}
