import { timingSafeEqual } from "node:crypto"

export type KeyValidationResult = { ok: true; key: Buffer } | { ok: false; reason: string }

export function validateKey(rawBase64: string): KeyValidationResult {
  const normalized = rawBase64.trim()

  if (!normalized) {
    return { ok: false, reason: "Key is required." }
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    return { ok: false, reason: "Key must be valid base64." }
  }

  const key = Buffer.from(normalized, "base64")

  if (key.length !== 32 || key.toString("base64") !== normalized) {
    return { ok: false, reason: "Key must decode to exactly 32 bytes." }
  }

  return { ok: true, key }
}

export function keysEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right)
}
