// Both headers are client-supplied and trivially spoofable unless a trusted reverse proxy sets
// them, so the result is usable for audit records and rate-limit keys but never as an
// authorization signal. `||` rather than `??` on purpose: a present-but-empty header must fall
// through to the next source instead of being returned as an empty address.
export function getIpAddress(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim()

  return forwardedFor || headers.get("x-real-ip") || null
}
