"use client"

import { Fragment, useEffect } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { Icon, Typography } from "@/components/ui"

import { dataExportStatusPresentation } from "../../labels"
import { type DataExportClientOption, type DataExportListItem } from "../../types"

import { DataExportHistory } from "./DataExportHistory"
import { DataExportRequestForm } from "./DataExportRequestForm"

// Polled rather than streamed. The worker owns the row and the page owns the session, so the only
// shared state is `data_exports`; a websocket or an SSE route to carry four status transitions would
// be a second transport to secure for an owner-only page that is open for a minute at a time. The
// interval only runs while an export is in flight.
const POLL_INTERVAL_MS = 3_000

type DataExportPanelProps = {
  clients: DataExportClientOption[]
  exports: DataExportListItem[]
  hasActiveExport: boolean
  locale: string
  timeZone: string
}

const DataExportPanel = ({
  clients,
  exports,
  hasActiveExport,
  locale,
  timeZone
}: DataExportPanelProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const activeExport = exports.find(
    (dataExport) => dataExport.status === "pending" || dataExport.status === "running"
  )

  useEffect(() => {
    if (!hasActiveExport) return

    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [hasActiveExport, router])

  return (
    <Fragment>
      <DataExportRequestForm
        clients={clients}
        hasActiveExport={hasActiveExport}
        onRequested={() => router.refresh()}
      />
      {/* The only announcement of a state change that happens without an interaction: the table below
          re-renders on each poll, which a screen reader reading a static region would never mention. */}
      <div aria-live="polite" className="flex min-h-5 items-center gap-2">
        {activeExport ? (
          <Fragment>
            <Icon
              name="Loader"
              className="text-muted-foreground size-4 animate-spin"
              aria-hidden="true"
            />
            <Typography affects={["muted", "small"]}>
              {t("settings.data.request.progressNotice", {
                status: t(dataExportStatusPresentation[activeExport.status].labelKey),
                progress: activeExport.progress
              })}
            </Typography>
          </Fragment>
        ) : null}
      </div>
      <DataExportHistory exports={exports} locale={locale} timeZone={timeZone} />
    </Fragment>
  )
}

export { DataExportPanel }
