export function getIpAddress(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim()

  return forwardedFor || headers.get("x-real-ip") || null
}
