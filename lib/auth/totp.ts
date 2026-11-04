import { createHmac } from "node:crypto"

import { constantTimeEqual } from "better-auth/crypto"

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

const VERIFICATION_WINDOW_STEPS = 1

type TotpUriOptions = {
  secret: string
  issuer: string
  account: string
  digits: number
  period: number
}

type TotpCodeCheck = {
  secret: string
  code: string
  digits: number
  period: number
  now: number
}

// Better Auth's two-factor plugin keys its HMAC with the decrypted secret string itself, so the key
// is that string's UTF-8 bytes and the URI carries base32 of the same bytes: an authenticator that
// scans this URI derives the key Better Auth verifies against (`@better-auth/utils`'s `createOTP`).
export function buildTotpUri({ secret, issuer, account, digits, period }: TotpUriOptions): string {
  const parameters = new URLSearchParams({
    secret: encodeBase32(Buffer.from(secret, "utf8")),
    issuer,
    digits: digits.toString(),
    period: period.toString()
  })

  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${parameters.toString()}`
}

// One step either side, Better Auth's `verifyTOTP` window, so a code this accepts is one Better
// Auth's `verify-totp` also accepts once the secret is in force. Every step is compared, without
// stopping at a match, so the time taken does not tell which step matched.
export function verifyTotpCode({ secret, code, digits, period, now }: TotpCodeCheck): boolean {
  const key = Buffer.from(secret, "utf8")
  const counter = Math.floor(now / (period * 1000))

  let matched = false

  for (let step = -VERIFICATION_WINDOW_STEPS; step <= VERIFICATION_WINDOW_STEPS; step++) {
    matched = constantTimeEqual(code, generateHotp(key, counter + step, digits)) || matched
  }

  return matched
}

function generateHotp(key: Buffer, counter: number, digits: number): string {
  const counterBytes = Buffer.alloc(8)

  counterBytes.writeBigUInt64BE(BigInt.asUintN(64, BigInt(counter)))

  const digest = createHmac("sha1", key).update(counterBytes).digest()
  const offset = digest.readUInt8(digest.length - 1) & 0x0f
  const truncated = digest.readUInt32BE(offset) & 0x7fffffff

  return (truncated % 10 ** digits).toString().padStart(digits, "0")
}

function encodeBase32(bytes: Buffer): string {
  let encoded = ""
  let buffer = 0
  let bits = 0

  for (const byte of bytes) {
    buffer = ((buffer << 8) | byte) & 0xfff
    bits += 8

    while (bits >= 5) {
      bits -= 5
      encoded += BASE32_ALPHABET.charAt((buffer >> bits) & 0x1f)
    }
  }

  if (bits > 0) encoded += BASE32_ALPHABET.charAt((buffer << (5 - bits)) & 0x1f)

  return encoded
}
