"use client"

import { useEffect, useState, useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import { toast } from "@/components/ui"

import { reportExportFailureLabelKeys } from "../labels"
import { getReportPdfState, requestReportPdf } from "../pdfExport"
import { type ReportQuery } from "../schemas"
import { isActiveReportExportStatus } from "../services"
import { type ReportExportState } from "../types"

// Polled rather than streamed, for the reason `features/dataExport` gives: the worker owns the row
// and the page owns the session, so the only shared state is `report_exports`, and an SSE route to
// carry three status transitions would be a second transport to secure. The interval only runs while
// a render is in flight.
const POLL_INTERVAL_MS = 2_000

export type ReportPdfExportState = {
  isWorking: boolean
  request: (query: ReportQuery) => void
}

export function useReportPdfExport(): ReportPdfExportState {
  const { t } = useTranslation()

  const [isRequesting, startRequesting] = useTransition()

  const [exportId, setExportId] = useState<string | null>(null)

  const isWorking = isRequesting || exportId !== null

  useEffect(() => {
    if (!exportId) return

    const settle = (state: ReportExportState) => {
      if (state.status === "ready" && state.downloadPath) {
        // The route answers with `Content-Disposition: attachment`, so the browser saves the file
        // and stays on the page. Assigning the location rather than clicking a synthesised anchor
        // keeps the download on the path the keyboard-triggered request started.
        window.location.assign(state.downloadPath)

        toast.success(t("reports.export.pdfReady"))

        return
      }

      toast.error(
        state.failureReason
          ? t(reportExportFailureLabelKeys[state.failureReason])
          : t("reports.errors.pdfExportFailed")
      )
    }

    const poll = async () => {
      const result = await getReportPdfState({ id: exportId })

      if ("error" in result) {
        setExportId(null)
        toast.error(result.error)

        return
      }

      if (isActiveReportExportStatus(result.data.status)) return

      setExportId(null)
      settle(result.data)
    }

    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [exportId, t])

  const request = (query: ReportQuery) => {
    if (isWorking) return

    startRequesting(async () => {
      const result = await requestReportPdf(query)

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setExportId(result.data.id)
      toast.success(t("reports.export.pdfRequested"))
    })
  }

  return { isWorking, request }
}
