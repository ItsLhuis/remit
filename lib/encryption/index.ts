import { env } from "@/lib/env"

import { decryptString, encryptString } from "./aes"

const key = Buffer.from(env.REMIT_ENCRYPTION_KEY, "base64")

export function encrypt(plaintext: string): string {
  return encryptString(plaintext, key)
}

export function decrypt(ciphertext: string): string {
  return decryptString(ciphertext, key)
}
