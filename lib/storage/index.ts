export * from "./limits"

export function resolveStorageUrl(keyOrUrl: string | null | undefined): string | null {
  if (!keyOrUrl) return null

  if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
    return keyOrUrl
  }

  // Written as a literal `process.env.NEXT_PUBLIC_*` member expression, not read through
  // `lib/config/env.ts`: this helper runs in client components, and Next.js only inlines a public
  // variable into the browser bundle when it sees that exact expression. Routing it through the
  // validated `env` object would also drag pino and that module's `process.exit` into the client
  // graph, and would resolve to `undefined` in the browser.
  const baseUrl = process.env.NEXT_PUBLIC_STORAGE_BASE_URL

  if (!baseUrl) {
    return keyOrUrl
  }

  return `${baseUrl}/${keyOrUrl}`
}
