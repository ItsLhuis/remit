"use client"

import { type TFunction } from "@/lib/i18n"

import { formatBytes, formatDate } from "@/lib/utils"

import { Badge, Button, DataTableColumnHeader, Icon, Skeleton, Typography } from "@/components/ui"

import { type ColumnDef } from "@/hooks"

import {
  dataExportFailureReasonLabelKeys,
  dataExportScopeLabelKeys,
  dataExportStatusPresentation
} from "../../labels"
import { buildDataExportDownloadPath } from "../../services"
import { type DataExportListItem } from "../../types"

type DataExportColumnsOptions = {
  locale: string
  t: TFunction
  timeZone: string
}

export function getDataExportColumns({
  locale,
  t,
  timeZone
}: DataExportColumnsOptions): ColumnDef<DataExportListItem>[] {
  return [
    {
      accessorKey: "scope",
      enableHiding: false,
      meta: {
        label: t("settings.data.table.scope"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.data.table.scope")} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{t(dataExportScopeLabelKeys[row.original.scope])}</span>
          {row.original.clientName ? (
            <Typography affects={["muted", "tiny"]}>{row.original.clientName}</Typography>
          ) : null}
        </div>
      )
    },
    {
      accessorKey: "status",
      meta: {
        label: t("settings.data.table.status"),
        skeleton: <Skeleton className="h-5 w-24 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.data.table.status")} />
      ),
      cell: ({ row }) => {
        const dataExport = row.original
        const presentation = dataExportStatusPresentation[dataExport.status]

        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={presentation.variant}>
              <Icon name={presentation.icon} aria-hidden="true" />
              {t(presentation.labelKey)}
            </Badge>
            {dataExport.status === "running" ? (
              <Typography affects={["muted", "tiny"]}>
                {t("settings.data.request.progressNotice", {
                  status: t(presentation.labelKey),
                  progress: dataExport.progress
                })}
              </Typography>
            ) : null}
            {dataExport.failureReason ? (
              <Typography affects={["muted", "tiny"]}>
                {t(dataExportFailureReasonLabelKeys[dataExport.failureReason])}
              </Typography>
            ) : null}
          </div>
        )
      }
    },
    {
      accessorKey: "requestedAt",
      meta: {
        label: t("settings.data.table.requested"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.data.table.requested")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {formatDate(row.original.requestedAt, { locale, timeZone })}
        </span>
      )
    },
    {
      accessorKey: "sizeBytes",
      meta: {
        label: t("settings.data.table.size"),
        skeleton: <Skeleton className="h-3.5 w-16" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.data.table.size")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.sizeBytes === null
            ? t("settings.data.emptyValue")
            : formatBytes(row.original.sizeBytes, locale)}
        </span>
      )
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      meta: {
        headerClassName: "w-28",
        cellClassName: "text-right",
        skeleton: <Skeleton className="ml-auto h-7 w-24 rounded-md" />
      },
      cell: ({ row }) => {
        const dataExport = row.original

        // Only a `ready` export has an object behind it, and `getDataExportArchive` refuses every other
        // status, so a button on a queued row could only ever produce a 404.
        if (dataExport.status !== "ready") return null

        return (
          <Button asChild size="sm" variant="outline">
            {/* A real link rather than a fetch: the response is an attachment the browser streams to
                disk, and routing it through JavaScript would buffer the whole archive in the tab. */}
            <a href={buildDataExportDownloadPath(dataExport.id)}>
              <Icon name="Download" aria-hidden="true" />
              {t("settings.data.download")}
            </a>
          </Button>
        )
      }
    }
  ]
}
