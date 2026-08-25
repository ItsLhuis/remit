import { expect, test } from "vitest"

import { ATTACHMENT_MIME_TYPES } from "../../schemas"
import { isPreviewableImage } from "../attachmentPreview"

test("treats every raster image type as previewable", () => {
  const images = ["image/gif", "image/jpeg", "image/png", "image/webp"]

  expect(images.every(isPreviewableImage)).toBe(true)
})

// A PDF thumbnail would need a render pass, and the panel is a list of what a record holds rather
// than a document viewer.
test("does not treat a PDF as previewable", () => {
  expect(isPreviewableImage("application/pdf")).toBe(false)
})

// The route's inline allowlist and this one must agree: anything previewable is rendered inline on
// the instance's own origin, so a type that becomes previewable here without becoming inline-safe
// there would render as a broken thumbnail rather than silently as something worse.
test("never claims a non-image allowed attachment type is previewable", () => {
  const nonImages = ATTACHMENT_MIME_TYPES.filter((mimeType) => !mimeType.startsWith("image/"))

  expect(nonImages.some(isPreviewableImage)).toBe(false)
})
