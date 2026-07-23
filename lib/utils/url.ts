// The protocol allowlist is the point: an unvalidated URL rendered into an `href` can carry a
// `javascript:` or `data:` scheme and execute on click, so anything user-supplied passes here
// before it reaches markup.
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)

    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}
