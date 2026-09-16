export * from "./limits"

// Relative, same-origin, and built from nothing but the key: public objects reach a browser only
// through `app/api/storage/[...key]/route.ts`, so no storage address has to travel into the client
// bundle, where Next.js would freeze it at build time (ADR-0040). Absolute URLs pass through
// untouched for values stored as a full address rather than a key.
export function resolveStorageUrl(keyOrUrl: string | null | undefined): string | null {
  if (!keyOrUrl) return null

  if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
    return keyOrUrl
  }

  return `/api/storage/${keyOrUrl.split("/").map(encodeURIComponent).join("/")}`
}
