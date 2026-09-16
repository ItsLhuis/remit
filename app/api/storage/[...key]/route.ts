import { NextResponse } from "next/server"

import { t } from "@/lib/i18n/server"

import { logger } from "@/lib/logger"

import { getPublicObjectStream } from "@/lib/storage/s3"

export const dynamic = "force-dynamic"

// Segments of letters, digits, dots, underscores and hyphens, none of them starting with a dot: every
// key the upload route mints has this shape, and it cannot spell `..` or an empty segment.
const STORAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/

const STORAGE_KEY_MAX_LENGTH = 1024

// The types the upload route admits into the public bucket. Anything else found there is handed over
// as an opaque download rather than rendered, so a mislabelled object can never be interpreted as a
// document on this origin.
const INLINE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
])

// The anonymous read path for the public bucket — avatars, logos, client images, template images and
// expense receipts — and the reason object storage needs no public address (ADR-0040). Anonymous on
// purpose: this is the same exposure the bucket had when browsers read it directly, and a random key
// minted by the upload route is still the whole access control. `lib/storage/s3.ts`'s
// `getPublicObjectStream` cannot read any other bucket, so documents and exports stay unreachable
// from here whatever key is asked for.
//
// The proxy's matcher skips this route, so it sets its own headers. It carries no page
// Content-Security-Policy: a receipt PDF opens in the browser's viewer, which a `default-src 'self'`
// policy on the PDF response itself would refuse to embed.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
): Promise<Response> {
  const { key } = await params

  const objectKey = key.join("/")

  if (objectKey.length > STORAGE_KEY_MAX_LENGTH || !STORAGE_KEY_PATTERN.test(objectKey)) {
    return notFound()
  }

  let object: Awaited<ReturnType<typeof getPublicObjectStream>>

  try {
    object = await getPublicObjectStream(objectKey)
  } catch (error) {
    logger.error({ action: "api.storage.GET", objectKey, err: error }, "Storage read failed")

    return withNoSniff(
      NextResponse.json({ error: t("errors.somethingWentWrong") }, { status: 500 })
    )
  }

  if (!object) return notFound()

  const inlineType =
    object.contentType !== null && INLINE_MIME_TYPES.has(object.contentType)
      ? object.contentType
      : null

  const responseHeaders = new Headers({
    "Content-Type": inlineType ?? "application/octet-stream",
    "Content-Disposition": inlineType ? "inline" : "attachment",
    // Immutable because a key is never written twice: the upload route mints a fresh random key for
    // every file, and replacing an avatar or a logo stores a new object rather than overwriting one.
    "Cache-Control": "public, max-age=31536000, immutable",
    "Cross-Origin-Resource-Policy": "same-origin"
  })

  if (object.contentLength !== null) {
    responseHeaders.set("Content-Length", String(object.contentLength))
  }

  return withNoSniff(new NextResponse(object.body, { headers: responseHeaders }))
}

function notFound(): NextResponse {
  return withNoSniff(NextResponse.json({ error: t("errors.notFound") }, { status: 404 }))
}

function withNoSniff(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff")

  return response
}
