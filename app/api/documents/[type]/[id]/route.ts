import { headers } from "next/headers"

import { NextResponse } from "next/server"

import { z } from "zod"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { logger } from "@/lib/logger"

import { findDocumentPdf } from "@/lib/pdf"
import { getDocumentObjectStream } from "@/lib/storage/s3"

export const dynamic = "force-dynamic"

// The only way a rendered document PDF leaves the instance, and the reason the documents bucket has
// no anonymous read policy (`lib/storage/s3.ts`). An invoice is a money document: reachable by URL
// alone was rejected as its default, so the object is credentialed here instead.
//
// Any authenticated session may read one, unlike `/api/exports/[id]` which is owner-only. An export
// is the whole instance in a single file; an invoice PDF is the same business record every role
// already sees rendered in the application, so gating it by role would deny an accountant the
// printable form of a document they can read on screen.
const documentParamsSchema = z.object({
  type: z.enum(["invoice", "proposal", "contract", "contract_signed", "credit_note"]),
  id: z.uuid()
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
): Promise<Response> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) {
    return noindexJson({ error: t("errors.unauthorized") }, 401)
  }

  const parsed = documentParamsSchema.safeParse(await params)

  // 404 rather than 400: an unknown document kind and a document that does not exist are the same
  // answer to a caller, and distinguishing them only tells a prober which kinds are real.
  if (!parsed.success) {
    return noindexJson({ error: t("errors.notFound") }, 404)
  }

  const document = await findDocumentPdf(parsed.data.type, parsed.data.id)

  if (!document) {
    return noindexJson({ error: t("errors.notFound") }, 404)
  }

  try {
    const object = await getDocumentObjectStream(document.storageKey)

    return new NextResponse(object.body, {
      headers: {
        "Content-Type": "application/pdf",
        // The filename is a document number this instance generated, not user input, so the plain
        // `filename` parameter needs no RFC 5987 encoding.
        "Content-Disposition": `attachment; filename="${document.filename}"`,
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
      {
        action: "api.documents.GET",
        type: parsed.data.type,
        documentId: parsed.data.id,
        err: error
      },
      "Document PDF download failed"
    )

    return noindexJson({ error: t("errors.somethingWentWrong") }, 500)
  }
}

function noindexJson(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "X-Robots-Tag": "noindex, nofollow" }
  })
}
