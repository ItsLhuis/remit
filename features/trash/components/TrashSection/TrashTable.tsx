"use client"

import { useCallback, useMemo, useState, useTransition } from "react"

import Link from "next/link"

import { toast } from "sonner"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
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
import { TRASH_URL_KEY_PREFIX } from "../../schemas"
import { type TrashItem, type TrashSectionData } from "../../types"

import { getTrashColumns } from "./trashColumns"

type TrashTableProps = {
  data: TrashSectionData
}

const TrashTable = ({ data }: TrashTableProps) => {
  const { t } = useTranslation()

  const [isPending, startTransition] = useTransition()

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

      // A client comes back with its portal link off (`restoreClient`), so its restore says so
      // rather than leaving the owner to find a dead link the next time they send one.
      if (item.kind === "client") {
        toast.success(t("trash.restored"), { description: t("trash.restoredClientPortalOff") })

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
        locale: data.locale,
        timeZone: data.timeZone,
        restoringId,
        onRestore: (item) => {
          void handleRestore(item)
        }
      }),
    [t, data.locale, data.timeZone, restoringId, handleRestore]
  )

  const { table } = useDataTable({
    data: data.items,
    columns,
    getRowId: (item) => `${item.kind}:${item.id}`,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    urlKeyPrefix: TRASH_URL_KEY_PREFIX,
    enableRowSelection: false,
    columnVisibilityStorageKey: "trash:column-visibility"
  })

  return (
    <DataTable
      table={table}
      caption={t("trash.title")}
      isLoading={isPending}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <Typography affects={["small", "medium"]}>{t("trash.title")}</Typography>
          <Typography affects={["muted", "tiny"]}>
            {data.isNarrowedToRecord ? t("trash.narrowed") : t("trash.description")}
          </Typography>
        </div>
        {data.isNarrowedToRecord ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/data#trash">{t("trash.showAll")}</Link>
          </Button>
        ) : null}
      </div>
    </DataTable>
  )
}

export { TrashTable }
