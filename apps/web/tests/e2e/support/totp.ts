import { createHmac } from "node:crypto"

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

const TOTP_DIGITS = 6
const TOTP_PERIOD_SECONDS = 30

// RFC 6238 TOTP over the base32 secret carried in an `otpauth://` URI, so an automated run can
// answer Better Auth's TOTP challenge without a phone. Better Auth signs with the raw secret bytes
// and base32-encodes them into the URI (`@better-auth/utils`'s `createOTP`/`generateQRCode`), so
// decoding the URI secret back to bytes reproduces its HMAC key exactly. The defaults match the
// plugin's: SHA-1, six digits, thirty-second period.
export function generateTotpCode(secret: string): string {
  const key = decodeBase32(secret)
  const counter = Math.floor(Date.now() / (TOTP_PERIOD_SECONDS * 1000))

  const counterBytes = Buffer.alloc(8)

  counterBytes.writeBigUInt64BE(BigInt(counter))

  const digest = createHmac("sha1", key).update(counterBytes).digest()
  const offset = digest[digest.length - 1] & 0x0f

  const truncated =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  return (truncated % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0")
}

function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/\s+/g, "").replace(/=+$/, "")

  const bytes: number[] = []

  let buffer = 0
  let bits = 0

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character)

    if (index === -1) throw new Error(`Invalid base32 character in TOTP secret: ${character}`)

    buffer = (buffer << 5) | index
    bits += 5

    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }

  return Buffer.from(bytes)
}
