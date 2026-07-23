// Escapes text for interpolation into HTML; it is not a sanitizer and must never be used to admit
// caller-supplied markup. The `&` replacement has to stay first, or it would re-escape the
// ampersands introduced by the replacements after it.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
