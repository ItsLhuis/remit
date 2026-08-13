"use client"

import { useMemo } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Typography
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { type DataExportListItem } from "../../types"

import { getDataExportColumns } from "./historyColumns"

type DataExportHistoryProps = {
  exports: DataExportListItem[]
  locale: string
  timeZone: string
}

const DataExportHistory = ({ exports, locale, timeZone }: DataExportHistoryProps) => {
  const { t } = useTranslation()

  const columns = useMemo<ColumnDef<DataExportListItem>[]>(
    () => getDataExportColumns({ t, locale, timeZone }),
    [t, locale, timeZone]
  )

  const { table } = useDataTable({
    data: exports,
    columns,
    getRowId: (dataExport) => dataExport.id,
    enableRowSelection: false,
    columnVisibilityStorageKey: "data-exports:column-visibility",
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  return (
    <DataTable
      table={table}
      caption={t("settings.data.history.title")}
      empty={
        <Empty className="border-0 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon name="Archive" />
            </EmptyMedia>
            <EmptyTitle>{t("settings.data.history.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("settings.data.history.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    >
      <div className="flex flex-col gap-0.5">
        <Typography affects={["small", "medium"]}>{t("settings.data.history.title")}</Typography>
        <Typography affects={["muted", "tiny"]}>
          {t("settings.data.history.description")}
        </Typography>
      </div>
    </DataTable>
  )
}

export { DataExportHistory }
