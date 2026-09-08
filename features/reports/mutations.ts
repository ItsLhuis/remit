"use server"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { serializeCsv } from "@/lib/utils"

import { reportColumnLabelKeys, reportDimensionLabelKeys } from "./labels"
import { requireReportExport } from "./mutationContext"
import { getReportDefaults, getReportResult } from "./queries"
import { reportQuerySchema, scopeReportFilters, toReportFilterSnapshot } from "./schemas"
import { buildReportCsvRows, buildReportExportFilename, countReportRows } from "./services"

export type ExportReportResult =
  | { data: { filename: string; csv: string; rowCount: number } }
  | { error: string }

export async function exportReportCsv(input: unknown): Promise<ExportReportResult> {
  const gate = await requireReportExport()

  if ("error" in gate) return gate

  // The caller hands over the query the page was rendered from rather than a URL, so the export
  // covers exactly the rows on screen. It is still re-validated and re-scoped here: a server action
  // is reachable by anything that can reach the app, not only by this page.
  const parsed = reportQuerySchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const query = scopeReportFilters(parsed.data)
  const { context } = gate

  try {
    const defaults = await getReportDefaults()
    const result = await getReportResult(query, defaults)

    const csv = serializeCsv(
      buildReportCsvRows(result, {
        label: t(reportDimensionLabelKeys[query.report]),
        sublabel: t("reports.export.columns.detail"),
        currency: t("reports.export.columns.currency"),
        columns: result.columns.map((column) => t(reportColumnLabelKeys[column])),
        total: t("reports.export.columns.total")
      })
    )

    const exportedAt = new Date()
    const rowCount = countReportRows(result)

    // Written before the CSV reaches the caller, and never updated afterwards: the audit row is the
    // record that this slice of the instance's books left the application.
    await writeAudit("report.exported", {
      actorUserId: context.userId,
      actorRole: context.role,
      targetEntityType: "report",
      targetEntityId: null,
      metadata: {
        report: query.report,
        rowCount,
        exportedAt: exportedAt.toISOString(),
        filters: toReportFilterSnapshot(query)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    })

    return {
      data: {
        filename: buildReportExportFilename(query.report, exportedAt, "csv"),
        csv,
        rowCount
      }
    }
  } catch (error) {
    logger.error(
      { action: "exportReportCsv", userId: context.userId, report: query.report, err: error },
      "Report export failed"
    )

    return { error: t("reports.errors.exportFailed") }
  }
}
