"use server"

import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress, serializeCsv } from "@/lib/utils"

import { reportColumnLabelKeys, reportDimensionLabelKeys } from "./labels"
import { getReportDefaults, getReportResult } from "./queries"
import { reportQuerySchema, scopeReportFilters, type ReportKind, type ReportQuery } from "./schemas"
import { buildReportCsvRows, countReportRows } from "./services"

export type ExportReportResult =
  | { data: { filename: string; csv: string; rowCount: number } }
  | { error: string }

type ReportExportContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type ReportExportGate = { context: ReportExportContext } | { error: string }

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
        filters: toFilterSnapshot(query)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    })

    return {
      data: {
        filename: `${toFilenameSlug(query.report)}-${exportedAt.toISOString().slice(0, 10)}.csv`,
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

// Reports are read-only, so this is the feature's only gate, and it is the same cut as
// `requireExpenseExport`: a report is the whole book of one dimension in one file, granted to the
// roles that exist to see the books rather than to the assistant role that exists to enter them.
async function requireReportExport(): Promise<ReportExportGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner" && role !== "accountant") return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

function toFilterSnapshot(query: ReportQuery): Record<string, unknown> {
  return {
    from: query.from?.toISOString() ?? null,
    to: query.to?.toISOString() ?? null,
    clientId: query.clientId,
    projectId: query.projectId,
    taxRateId: query.taxRateId
  }
}

// The report key in kebab case, so a downloaded file sorts and reads like a filename rather than
// like an identifier. Derived from the key itself so a new report needs no second list to update.
function toFilenameSlug(report: ReportKind): string {
  return report.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
