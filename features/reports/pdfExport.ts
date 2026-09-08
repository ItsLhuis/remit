"use server"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { enqueueJob } from "@/lib/jobs"

import { database } from "@/database"
import { reportExports } from "@/database/schema"

import { requireReportExport } from "./mutationContext"
import { getReportExportState } from "./queries"
import {
  reportExportIdSchema,
  reportQuerySchema,
  scopeReportFilters,
  toReportFilterSnapshot
} from "./schemas"
import { type ReportExportState } from "./types"

export type RequestReportPdfResult = { data: ReportExportState } | { error: string }

export type ReportPdfStateResult = { data: ReportExportState } | { error: string }

// The producer half of ADR-0022 for reports, kept out of `mutations.ts` because these two are one
// flow rather than one write: a request that returns before the artifact exists is only useful
// beside the read that says whether it does yet.
export async function requestReportPdf(input: unknown): Promise<RequestReportPdfResult> {
  const gate = await requireReportExport()

  if ("error" in gate) return gate

  // Re-validated and re-scoped exactly as the CSV export is, and for the same reason: a server
  // action is reachable by anything that can reach the app. What it produces here is also the row
  // the worker will render from, so an id smuggled in for a filter this report does not offer must
  // be dropped before it is persisted rather than before it is used.
  const parsed = reportQuerySchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const query = scopeReportFilters(parsed.data)
  const { context } = gate

  try {
    const [row] = await database
      .insert(reportExports)
      .values({
        report: query.report,
        filters: toReportFilterSnapshot(query),
        requestedByUserId: context.userId
      })
      .returning({ id: reportExports.id })

    if (!row) return { error: t("reports.errors.pdfExportFailed") }

    // The first of two audit entries, the way a data export is recorded at request and at
    // completion. It names the report and the filters that produced it and never a row of its data:
    // the audit log records that this slice of the books was asked for, not what it said.
    await writeAudit("report.pdf_export.requested", {
      actorUserId: context.userId,
      actorRole: context.role,
      targetEntityType: "report_export",
      targetEntityId: row.id,
      metadata: { report: query.report, filters: toReportFilterSnapshot(query) },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    })

    // After the row, never before: `enqueueJob` logs a queue outage rather than throwing, so a job
    // enqueued first and then lost to a failed insert would render a report that has nowhere to
    // report back to.
    await enqueueJob(
      "report.pdf.render",
      { reportExportId: row.id },
      { jobId: `report.pdf.render.${row.id}` }
    )

    return { data: { id: row.id, status: "pending", failureReason: null, downloadPath: null } }
  } catch (error) {
    logger.error(
      { action: "requestReportPdf", userId: context.userId, report: query.report, err: error },
      "Report PDF export request failed"
    )

    return { error: t("reports.errors.pdfExportFailed") }
  }
}

export async function getReportPdfState(input: unknown): Promise<ReportPdfStateResult> {
  const gate = await requireReportExport()

  if ("error" in gate) return gate

  const parsed = reportExportIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const state = await getReportExportState(parsed.data.id)

  if (!state) return { error: t("errors.notFound") }

  return { data: state }
}
