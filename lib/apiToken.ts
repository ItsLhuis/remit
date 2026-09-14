import { createHash, timingSafeEqual } from "node:crypto"

import { mintPublicToken } from "./publicToken"

// The public API's credential format, in `lib/` rather than in either feature that uses it: the
// settings surface mints tokens and `features/api` authenticates them, and a feature-to-feature
// import between those two would tie the settings graph to every read the API serves. Its own
// module rather than `lib/utils` for the reason `lib/publicToken.ts` gives — `node:crypto` has no
// browser build.

// Every token begins with this, so a secret scanner can recognise one in a commit or a log and an
// operator can tell a Remit credential from any other string in their configuration.
export const API_TOKEN_PREFIX = "remit_"

// `mintPublicToken` supplies the random part: 32 bytes as unpadded base64url is always 43
// characters from this alphabet.
const API_TOKEN_PATTERN = /^remit_[A-Za-z0-9_-]{43}$/

const DISPLAY_PREFIX_LENGTH = API_TOKEN_PREFIX.length + 6

const BEARER_PATTERN = /^Bearer ([^\s]+)$/

export type IssuedApiToken = {
  token: string
  tokenHash: string
  tokenPrefix: string
}

// The random part comes from the one CSPRNG minter every bearer credential in the instance goes
// through, so an API token can never carry less entropy than a document link. The caller shows
// `token` once and persists only the other two fields.
export function issueApiToken(): IssuedApiToken {
  const token = `${API_TOKEN_PREFIX}${mintPublicToken()}`

  return { token, tokenHash: hashApiToken(token), tokenPrefix: getApiTokenDisplayPrefix(token) }
}

export function isWellFormedApiToken(value: string): boolean {
  return API_TOKEN_PATTERN.test(value)
}

// SHA-256, deliberately fast. A slow password hash exists to make guessing a low-entropy secret
// expensive, and this secret has 256 bits of entropy: no guess rate makes that searchable, while a
// slow hash would add its full cost to every API request, because the hash is the lookup key the
// request is authenticated by.
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

// Constant-time over the two digests. The row is already found by an index lookup on the hash, so
// this is defence in depth rather than the only barrier: it keeps the final equality from being a
// byte-by-byte early exit should the lookup ever change shape.
export function matchesApiTokenHash(candidateHash: string, storedHash: string): boolean {
  const candidate = Buffer.from(candidateHash, "hex")
  const stored = Buffer.from(storedHash, "hex")

  if (candidate.length !== stored.length || candidate.length === 0) return false

  return timingSafeEqual(candidate, stored)
}

export function getApiTokenDisplayPrefix(token: string): string {
  return token.slice(0, DISPLAY_PREFIX_LENGTH)
}

export function parseBearerCredential(header: string | null): string | null {
  if (!header) return null

  const match = BEARER_PATTERN.exec(header.trim())

  return match?.[1] ?? null
}
