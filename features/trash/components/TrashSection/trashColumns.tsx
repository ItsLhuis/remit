"use client"

import { type TFunction } from "@/lib/i18n"

import { formatDate } from "@/lib/utils"

import {
  Badge,
  Button,
  DataTableColumnHeader,
  Icon,
  Skeleton,
  Spinner,
  Typography
} from "@/components/ui"

import { type ColumnDef } from "@/hooks"

import { trashEntityLabelKeys } from "../../labels"
import { type TrashItem } from "../../types"

type TrashColumnsOptions = {
  locale: string
  t: TFunction
  timeZone: string
  restoringId: string | null
  onRestore: (item: TrashItem) => void
}

export function getTrashColumns({
  locale,
  t,
  timeZone,
  restoringId,
  onRestore
}: TrashColumnsOptions): ColumnDef<TrashItem>[] {
  return [
    {
      accessorKey: "title",
      enableHiding: false,
      meta: {
        label: t("trash.columns.record"),
        skeleton: <Skeleton className="h-3.5 w-40" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("trash.columns.record")} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{row.original.title}</span>
          {row.original.context ? (
            <Typography affects={["muted", "tiny"]}>{row.original.context}</Typography>
          ) : null}
        </div>
      )
    },
    {
      accessorKey: "kind",
      meta: {
        label: t("trash.columns.type"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("trash.columns.type")} />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary">{t(trashEntityLabelKeys[row.original.kind])}</Badge>
      )
    },
    {
      accessorKey: "deletedAt",
      meta: {
        label: t("trash.columns.deletedAt"),
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("trash.columns.deletedAt")} />
      ),
      cell: ({ row }) => (
        <Typography affects={["muted", "small"]}>
          {formatDate(row.original.deletedAt, { locale, timeZone })}
        </Typography>
      )
    },
    {
      accessorKey: "purgeDueAt",
      meta: {
        label: t("trash.columns.purgeDueAt"),
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("trash.columns.purgeDueAt")} />
      ),
      cell: ({ row }) =>
        row.original.purgeDueAt ? (
          <Typography affects={["muted", "small"]}>
            {formatDate(row.original.purgeDueAt, { locale, timeZone })}
          </Typography>
        ) : (
          <Typography affects={["muted", "small"]}>{t("trash.purgeNever")}</Typography>
        )
    },
    {
      id: "actions",
      enableHiding: false,
      meta: {
        label: t("trash.actions.restore"),
        skeleton: <Skeleton className="h-8 w-24" />
      },
      header: () => null,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={restoringId !== null}
          onClick={() => onRestore(row.original)}
        >
          {restoringId === row.original.id ? <Spinner /> : <Icon name="Undo2" aria-hidden="true" />}
          {t("trash.actions.restore")}
        </Button>
      )
    }
  ]
}
