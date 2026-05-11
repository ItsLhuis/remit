export function resolveStorageUrl(keyOrUrl: string | null | undefined): string | null {
  if (!keyOrUrl) return null

  if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
    return keyOrUrl
  }

  const baseUrl = process.env.NEXT_PUBLIC_STORAGE_BASE_URL

  if (!baseUrl) {
    return keyOrUrl
  }

  return `${baseUrl}/${keyOrUrl}`
}
