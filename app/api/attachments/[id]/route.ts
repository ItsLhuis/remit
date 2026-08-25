import { headers } from "next/headers"

import { NextResponse } from "next/server"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { logger } from "@/lib/logger"

import { getDocumentObjectStream } from "@/lib/storage/s3"

import { getAttachmentForDownload } from "@/features/attachments/server"

export const dynamic = "force-dynamic"

const INLINE_RENDERABLE_MIME_TYPES = ["image/gif", "image/jpeg", "image/png", "image/webp"]

// The only way an attachment leaves the instance, and the reason attachments are presigned into the
// private `documents` bucket rather than the anonymously-readable one: a client's signed NDA or a
// project brief must not be reachable by URL alone (ADR-0028).
//
// Any authenticated session may read one, matching `app/api/documents/[type]/[id]/route.ts`. The
// refusal that matters is not the role — it is `getAttachmentForDownload` requiring the record the
// attachment hangs off to still be live, so holding an id from a deleted record is not enough.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) {
    return noindexJson({ error: t("errors.unauthorized") }, 401)
  }

  const attachment = await getAttachmentForDownload(await params)

  // 404 for a malformed id, a missing row, and a row whose parent is gone alike: telling those three
  // apart only tells a prober which ids are real.
  if (!attachment) {
    return noindexJson({ error: t("errors.notFound") }, 404)
  }

  // `?inline=1` is what the attachment panel's thumbnails ask for, and it is honoured only for the
  // four raster image types. Serving arbitrary user-uploaded bytes inline on this origin would make
  // an upload a stored-XSS vector; the allowlist in `features/attachments/schemas.ts` already keeps
  // SVG and HTML out, and this second gate means adding a type there cannot silently make it
  // renderable here too.
  const isInline =
    new URL(request.url).searchParams.get("inline") === "1" &&
    INLINE_RENDERABLE_MIME_TYPES.includes(attachment.mimeType)

  try {
    const object = await getDocumentObjectStream(attachment.storageKey)

    return new NextResponse(object.body, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": isInline ? "inline" : toContentDisposition(attachment.filename),
        "Content-Security-Policy": "default-src 'none'; sandbox",
        ...(object.contentLength === null
          ? {}
          : { "Content-Length": String(object.contentLength) }),
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow"
      }
    })
  } catch (error) {
    // Never the storage key: it is the only thing standing between the object and anyone who can
    // read a log (`security.md`).
    logger.error(
      { action: "api.attachments.GET", userId: session.user.id, err: error },
      "Attachment download failed"
    )

    return noindexJson({ error: t("errors.somethingWentWrong") }, 500)
  }
}

// Unlike the document route's filename, this one is whatever the user's disk called the file, so it
// can carry quotes, newlines, or non-ASCII. The ASCII fallback is stripped to characters that cannot
// terminate the quoted string or inject a second header, and the RFC 5987 `filename*` parameter
// carries the real name for every browser that reads it.
function toContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function noindexJson(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "X-Robots-Tag": "noindex, nofollow" }
  })
}
