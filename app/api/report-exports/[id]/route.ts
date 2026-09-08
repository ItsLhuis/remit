import { headers } from "next/headers"

import { NextResponse } from "next/server"

import { z } from "zod"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { getExportObjectStream } from "@/lib/storage/s3"

import { getReportExportArtifact } from "@/features/reports/server"

export const dynamic = "force-dynamic"

// The only way a rendered report PDF leaves the instance, and the reason it lands in the exports
// bucket: that bucket has no anonymous read policy (`lib/storage/s3.ts`), so the object is reachable
// only through this gate.
//
// The role cut repeats `requireReportExport` rather than calling it, because the two answers differ
// in shape: the action returns a translated string the page renders, and this route must choose a
// status code. A report is a slice of the books, so the owner and the accountant may fetch one and
// the assistant may not — the same line the CSV export draws.
const reportExportParamsSchema = z.object({ id: z.uuid() })

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) {
    return noindexJson({ error: t("errors.unauthorized") }, 401)
  }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  // 404 rather than 403, matching `/api/exports/[id]`: a role that may not export must not be able
  // to use the status code to learn that a report export with this id exists.
  if (role !== "owner" && role !== "accountant") {
    return noindexJson({ error: t("errors.notFound") }, 404)
  }

  const parsed = reportExportParamsSchema.safeParse(await params)

  if (!parsed.success) {
    return noindexJson({ error: t("errors.notFound") }, 404)
  }

  const artifact = await getReportExportArtifact(parsed.data.id)

  if (!artifact) {
    return noindexJson({ error: t("errors.notFound") }, 404)
  }

  try {
    const object = await getExportObjectStream(artifact.storageKey)

    // The moment the artifact actually leaves the server, and the one entry in its life with a
    // request behind it to attribute.
    await writeAudit("report.pdf_export.downloaded", {
      actorUserId: session.user.id,
      actorRole: role,
      targetEntityType: "report_export",
      targetEntityId: parsed.data.id,
      metadata: { filename: artifact.filename },
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    })

    return new NextResponse(object.body, {
      headers: {
        "Content-Type": "application/pdf",
        // `buildReportExportFilename` emits an ASCII slug and a date, so the plain `filename`
        // parameter needs no RFC 5987 encoding. A filename built any other way would.
        "Content-Disposition": `attachment; filename="${artifact.filename}"`,
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
      { action: "api.reportExports.GET", reportExportId: parsed.data.id, err: error },
      "Report PDF download failed"
    )

    return noindexJson({ error: t("reports.errors.pdfExportFailed") }, 500)
  }
}

function noindexJson(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "X-Robots-Tag": "noindex, nofollow" }
  })
}
