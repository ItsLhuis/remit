import { Readable } from "node:stream"

import { and, eq } from "drizzle-orm"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { renderHtmlToPdf } from "@/lib/pdf"
import { putExportObject } from "@/lib/storage/s3"

import { database } from "@/database"
import { reportExports } from "@/database/schema"

import { buildReportPdfDocument } from "./pdfDocument"
import { scopeReportFilters, storedReportQuerySchema, type ReportQuery } from "./schemas"
import {
  buildReportExportFilename,
  buildReportExportStorageKey,
  type ReportDocument,
  type ReportExportFailureReason
} from "./services"

// The consumer half of ADR-0022 for reports. A report is the only PDF in this repository that is not
// a document: it has no `pdf_upload_id` to point back at and is never re-read as the record of what
// was sent, so it lands in the credentialed exports bucket beside data-export archives rather than
// in the documents bucket through `storeDocumentPdf`.

const REPORT_PDF_CONTENT_TYPE = "application/pdf"

type ClaimedReportExport = {
  id: string
  report: string
  filters: unknown
  requestedByUserId: string | null
  requestedAt: Date
}

class ReportExportFailure extends Error {
  constructor(readonly reason: ReportExportFailureReason) {
    super(`Report PDF export failed: ${reason}`)
  }
}

// Retries are deliberately no-ops rather than a second attempt, the same trade
// `features/dataExport/jobs.ts` makes: `DEFAULT_JOB_OPTIONS` gives every job five attempts and the
// conditional claim below only accepts a row that is still `pending`, so attempts 2..5 of a failed
// render find `failed` and return. The reader has already been told it failed, and asking again is
// one click.
export async function renderReportPdf(payload: { reportExportId: string }): Promise<void> {
  const claimed = await claimReportExport(payload.reportExportId)

  if (!claimed) return

  try {
    const query = toReportQuery(claimed)
    const { document, rowCount } = await buildReportPdfDocument(query)

    const storageKey = await storeReportPdf(claimed, query, document)

    await database
      .update(reportExports)
      .set({ status: "ready", storageKey, completedAt: new Date() })
      .where(eq(reportExports.id, claimed.id))

    // The second half of the audit trail, after the request. No IP or user-agent: this runs in the
    // worker with no request behind it, and inventing the requester's last known address would put a
    // value in the audit log that nothing observed. The row count says how much was rendered; the
    // rows themselves never reach the log.
    await writeAudit("report.pdf_export.completed", {
      actorUserId: claimed.requestedByUserId,
      targetEntityType: "report_export",
      targetEntityId: claimed.id,
      metadata: { report: claimed.report, rowCount },
      ipAddress: null,
      userAgent: null
    })
  } catch (error) {
    await failReportExport(claimed, error)
  }
}

// A conditional update rather than a read-then-write: two deliveries of the same job would otherwise
// both see `pending` and launch two browsers for one artifact.
async function claimReportExport(exportId: string): Promise<ClaimedReportExport | null> {
  const [claimed] = await database
    .update(reportExports)
    .set({ status: "running", startedAt: new Date(), failureReason: null })
    .where(and(eq(reportExports.id, exportId), eq(reportExports.status, "pending")))
    .returning({
      id: reportExports.id,
      report: reportExports.report,
      filters: reportExports.filters,
      requestedByUserId: reportExports.requestedByUserId,
      requestedAt: reportExports.createdAt
    })

  return claimed ?? null
}

// Parsed and re-scoped rather than trusted, and this is the boundary that looks redundant and is
// not. The job payload carries only an id, so the query arrives as jsonb another process wrote: its
// dates are strings by the time Postgres returns them, and nothing in the column itself constrains
// the report vocabulary. Re-scoping repeats what the request action did because the row could have
// been written by an older build whose filter rules differed.
function toReportQuery(claimed: ClaimedReportExport): ReportQuery {
  const parsed = storedReportQuerySchema.safeParse({
    ...(claimed.filters && typeof claimed.filters === "object" ? claimed.filters : {}),
    report: claimed.report
  })

  if (!parsed.success) throw new ReportExportFailure("renderFailed")

  return scopeReportFilters(parsed.data)
}

async function storeReportPdf(
  claimed: ClaimedReportExport,
  query: ReportQuery,
  document: ReportDocument
): Promise<string> {
  const bytes = await renderHtmlToPdf({
    html: document.html,
    widthPx: document.widthPx,
    heightPx: document.heightPx
  })

  const storageKey = buildReportExportStorageKey(
    claimed.id,
    buildReportExportFilename(query.report, claimed.requestedAt, "pdf")
  )

  try {
    await putExportObject({
      objectKey: storageKey,
      body: Readable.from(bytes),
      contentLength: bytes.length,
      contentType: REPORT_PDF_CONTENT_TYPE
    })
  } catch (error) {
    logger.error(
      { action: "renderReportPdf", reportExportId: claimed.id, err: error },
      "Report PDF upload failed"
    )

    throw new ReportExportFailure("storageFailed")
  }

  return storageKey
}

async function failReportExport(claimed: ClaimedReportExport, error: unknown): Promise<void> {
  const reason = error instanceof ReportExportFailure ? error.reason : "renderFailed"

  // Never the rendered HTML or the bytes: a report is a slice of the instance's books in one file
  // (`security.md`). The id and the reason are enough to find the run.
  logger.error(
    { action: "renderReportPdf", reportExportId: claimed.id, reason, err: error },
    "Report PDF render failed"
  )

  await database
    .update(reportExports)
    .set({ status: "failed", failureReason: reason, completedAt: new Date() })
    .where(eq(reportExports.id, claimed.id))

  await writeAudit("report.pdf_export.failed", {
    actorUserId: claimed.requestedByUserId,
    targetEntityType: "report_export",
    targetEntityId: claimed.id,
    metadata: { report: claimed.report, reason },
    ipAddress: null,
    userAgent: null
  })
}
