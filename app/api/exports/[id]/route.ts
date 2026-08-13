import { headers } from "next/headers"

import { NextResponse } from "next/server"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { getExportObjectStream } from "@/lib/storage/s3"

import { getDataExportArchive } from "@/features/dataExport/server"

export const dynamic = "force-dynamic"

type DownloadContext = {
  ipAddress: string | null
  userAgent: string | null
  userId: string
}

// The only way an export archive leaves the instance. It exists as a route rather than a server action
// because the response is a streamed attachment, and it does the work the exports bucket deliberately
// cannot: the bucket has no anonymous read policy (see `lib/storage/s3.ts`), so the archive is
// reachable only through this gate.
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

  // 404 rather than 403, matching `requireRole`: a role that may not export must not be able to use
  // the status code to learn that an archive with this id exists.
  if (role !== "owner") {
    return noindexJson({ error: t("errors.notFound") }, 404)
  }

  const { id } = await params
  const archive = await getDataExportArchive({ exportId: id })

  if (!archive) {
    return noindexJson({ error: t("errors.notFound") }, 404)
  }

  try {
    const object = await getExportObjectStream(archive.storageKey)

    await writeDownloadAudit(
      {
        ipAddress: getIpAddress(requestHeaders),
        userAgent: requestHeaders.get("user-agent"),
        userId: session.user.id
      },
      id
    )

    return new NextResponse(object.body, {
      headers: {
        "Content-Type": "application/zip",
        // `buildExportFilename` emits an ASCII slug, so the plain `filename` parameter needs no RFC
        // 5987 encoding. A filename built any other way would.
        "Content-Disposition": `attachment; filename="${archive.filename}"`,
        ...(object.contentLength === null
          ? {}
          : { "Content-Length": String(object.contentLength) }),
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow"
      }
    })
  } catch (error) {
    logger.error(
      { action: "api.exports.GET", exportId: id, err: error },
      "Data export download failed"
    )

    return noindexJson({ error: t("settings.data.errors.downloadFailed") }, 500)
  }
}

// The third audit entry in an export's life, after the request and the assembly: this is the moment the
// archive actually leaves the server, and it is the one with a request behind it to attribute.
async function writeDownloadAudit(context: DownloadContext, exportId: string): Promise<void> {
  await writeAudit("data_export.downloaded", {
    actorUserId: context.userId,
    actorRole: "owner",
    targetEntityType: "data_export",
    targetEntityId: exportId,
    metadata: { exportId },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function noindexJson(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "X-Robots-Tag": "noindex, nofollow" }
  })
}
