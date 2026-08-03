import { timingSafeEqual } from "node:crypto"

// Deliberately its own module rather than an export of `lib/utils/index.ts`: that barrel is imported
// by client-safe schema modules, and `node:crypto` has no browser build, so a helper behind it would
// break every client component that pulls a schema in. Server callers import this path directly.
//
// One copy for every `/{letter}/[token]` route. It began as three identical feature-local files
// (proposals, contracts, invoices) that were merged here the moment the third appeared.

// Constant-time comparison of a caller-supplied public token against the stored one, per
// `.agents/rules/security.md`. `timingSafeEqual` throws on unequal lengths, so the length guard
// comes first; it leaks nothing, because the compared length is the one the caller itself chose.
export function matchesPublicToken(candidate: string, stored: string): boolean {
  const candidateBuffer = Buffer.from(candidate, "utf8")
  const storedBuffer = Buffer.from(stored, "utf8")

  if (candidateBuffer.length !== storedBuffer.length) return false

  return timingSafeEqual(candidateBuffer, storedBuffer)
}
