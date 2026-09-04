import { randomBytes, timingSafeEqual } from "node:crypto"

// Deliberately its own module rather than an export of `lib/utils/index.ts`: that barrel is imported
// by client-safe schema modules, and `node:crypto` has no browser build, so a helper behind it would
// break every client component that pulls a schema in. Server callers import this path directly.
//
// One copy for every `/{letter}/[token]` route, so the compare a token is admitted by cannot differ
// between the invoice, proposal, and contract surfaces — and one mint for every writer, so the
// entropy behind a token cannot differ either.

const TOKEN_BYTE_LENGTH = 32

// 256 bits from the platform CSPRNG, `base64url` so the value is a URL path segment as it stands.
// It takes no seed and no arguments on purpose: a token derivable from anything a caller already
// holds is not a bearer credential, which is why `scripts/core/seedDemo/plan.ts` mints demo tokens
// here rather than hashing its seed like every other identifier it builds.
export function mintPublicToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("base64url")
}

// Constant-time comparison of a caller-supplied public token against the stored one, per
// `.agents/rules/security.md`. `timingSafeEqual` throws on unequal lengths, so the length guard
// comes first; it leaks nothing, because the compared length is the one the caller itself chose.
export function matchesPublicToken(candidate: string, stored: string): boolean {
  const candidateBuffer = Buffer.from(candidate, "utf8")
  const storedBuffer = Buffer.from(stored, "utf8")

  if (candidateBuffer.length !== storedBuffer.length) return false

  return timingSafeEqual(candidateBuffer, storedBuffer)
}
