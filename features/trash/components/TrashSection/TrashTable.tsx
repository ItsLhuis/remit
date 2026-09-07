"use client"

import { useCallback, useMemo, useState } from "react"

import { toast } from "sonner"

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

import { restoreTrashedRecord } from "../../mutations"
import { type TrashItem } from "../../types"

import { getTrashColumns } from "./trashColumns"

type TrashTableProps = {
  items: TrashItem[]
  locale: string
  timeZone: string
}

const TrashTable = ({ items, locale, timeZone }: TrashTableProps) => {
  const { t } = useTranslation()

  const [restoringId, setRestoringId] = useState<string | null>(null)

  const handleRestore = useCallback(
    async (item: TrashItem) => {
      setRestoringId(item.id)

      const result = await restoreTrashedRecord({ id: item.id, kind: item.kind })

      setRestoringId(null)

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("trash.restored"))
    },
    [t]
  )

  const columns = useMemo<ColumnDef<TrashItem>[]>(
    () =>
      getTrashColumns({
        t,
        locale,
        timeZone,
        restoringId,
        onRestore: (item) => {
          void handleRestore(item)
        }
      }),
    [t, locale, timeZone, restoringId, handleRestore]
  )

  const { table } = useDataTable({
    data: items,
    columns,
    getRowId: (item) => item.id,
    enableRowSelection: false,
    columnVisibilityStorageKey: "trash:column-visibility",
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  return (
    <DataTable
      table={table}
      caption={t("trash.title")}
      empty={
        <Empty className="border-0 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon name="Trash2" />
            </EmptyMedia>
            <EmptyTitle>{t("trash.empty.title")}</EmptyTitle>
            <EmptyDescription>{t("trash.empty.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    >
      <div className="flex flex-col gap-0.5">
        <Typography affects={["small", "medium"]}>{t("trash.title")}</Typography>
        <Typography affects={["muted", "tiny"]}>{t("trash.description")}</Typography>
      </div>
    </DataTable>
  )
}

export { TrashTable }
