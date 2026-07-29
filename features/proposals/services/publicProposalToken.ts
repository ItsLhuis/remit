import { timingSafeEqual } from "node:crypto"

// Deliberately absent from services/index.ts, and therefore from the client-safe feature barrel:
// `node:crypto` has no browser build, so re-exporting this file would break any client component
// that imports from `@/features/proposals`. Server callers import it by direct path.

// Constant-time comparison of a caller-supplied public token against the stored one, per
// `.agents/rules/security.md`. `timingSafeEqual` throws on unequal lengths, so the length guard
// comes first; it leaks nothing, because the compared length is the one the caller itself chose.
export function matchesPublicToken(candidate: string, stored: string): boolean {
  const candidateBuffer = Buffer.from(candidate, "utf8")
  const storedBuffer = Buffer.from(stored, "utf8")

  if (candidateBuffer.length !== storedBuffer.length) return false

  return timingSafeEqual(candidateBuffer, storedBuffer)
}
