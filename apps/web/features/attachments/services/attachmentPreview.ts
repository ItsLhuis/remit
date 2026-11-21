const PREVIEWABLE_IMAGE_MIME_TYPES = ["image/gif", "image/jpeg", "image/png", "image/webp"]

// Which attachments render as a thumbnail rather than as a file row. A PDF is deliberately not
// previewable here: the thumbnail would need a render pass, and the attachment panel is a list of
// what a record holds, not a document viewer.
export function isPreviewableImage(mimeType: string): boolean {
  return PREVIEWABLE_IMAGE_MIME_TYPES.includes(mimeType)
}
