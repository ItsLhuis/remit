"use client"

import { Fragment, type Dispatch, type SetStateAction } from "react"

import { type TFunction } from "@/lib/i18n"

import { cn, formatCurrency, formatDate } from "@/lib/utils"

import {
  Badge,
  Checkbox,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Skeleton
} from "@/components/ui"

import { type ColumnDef } from "@/hooks"

import { TIME_ENTRY_BILLABLE_VALUES, TIME_ENTRY_INVOICED_VALUES } from "../../schemas"
import { type TimeEntryListItem } from "../../types"
import { Duration } from "../Duration"
import { TimeEntrySourceBadge } from "../TimeEntrySourceBadge"

type FilterOption = {
  label: string
  value: string
}

type TimeEntryColumnsOptions = {
  t: TFunction
  locale: string
  timeZone: string
  projectOptions: FilterOption[]
  taskOptions: FilterOption[]
  onEdit: (entry: TimeEntryListItem) => void
  setDeleteIds: Dispatch<SetStateAction<string[]>>
}

export function getTimeEntryColumns({
  t,
  locale,
  timeZone,
  projectOptions,
  taskOptions,
  onEdit,
  setDeleteIds
}: TimeEntryColumnsOptions): ColumnDef<TimeEntryListItem>[] {
  const billableOptions = TIME_ENTRY_BILLABLE_VALUES.map((value) => ({
    label: t(`timeTracking.billable.${value}`),
    value
  }))

  const invoicedOptions = TIME_ENTRY_INVOICED_VALUES.map((value) => ({
    label: t(`timeTracking.invoiced.${value}`),
    value
  }))

  return [
    {
      id: "select",
      enableSorting: false,
      enableHiding: false,
      meta: {
        headerClassName: "w-10",
        cellClassName: "w-10",
        skeleton: <Skeleton className="size-4 rounded-lg" />
      },
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllRowsSelected()
              ? true
              : table.getIsSomeRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => table.toggleAllRowsSelected(Boolean(value))}
          aria-label={t("common.table.selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          disabled={!row.getCanSelect()}
          aria-label={t("common.table.selectRow")}
        />
      )
    },
    {
      id: "started",
      accessorFn: (entry) => entry.startedAt,
      enableColumnFilter: true,
      meta: {
        label: t("timeTracking.fields.startedAt"),
        variant: "date",
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("timeTracking.fields.startedAt")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(row.original.startedAt, { locale, timeZone })}
        </span>
      )
    },
    {
      id: "project",
      accessorFn: (entry) => entry.projectId,
      enableSorting: true,
      enableColumnFilter: true,
      enableHiding: false,
      meta: {
        label: t("timeTracking.fields.project"),
        variant: "multiSelect",
        options: projectOptions,
        skeleton: (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        )
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("timeTracking.fields.project")} />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.original.projectName}</span>
          <span className="text-muted-foreground truncate text-xs">{row.original.clientName}</span>
        </div>
      )
    },
    {
      id: "task",
      accessorFn: (entry) => entry.taskId ?? "",
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("timeTracking.fields.task"),
        variant: "multiSelect",
        options: taskOptions,
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("timeTracking.fields.task")} />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm">
            {row.original.taskTitle ?? t("timeTracking.fields.noTask")}
          </span>
          {row.original.description ? (
            <span className="text-muted-foreground truncate text-xs">
              {row.original.description}
            </span>
          ) : null}
        </div>
      )
    },
    {
      id: "duration",
      accessorFn: (entry) => entry.durationSeconds ?? 0,
      meta: {
        align: "end",
        label: t("timeTracking.fields.duration"),
        skeleton: <Skeleton className="ml-auto h-3.5 w-16" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("timeTracking.fields.duration")} />
      ),
      cell: ({ row }) =>
        row.original.endedAt ? (
          <Duration seconds={row.original.durationSeconds} className="text-sm" />
        ) : (
          <Badge variant="info">
            <Icon name="Timer" aria-hidden="true" />
            {t("timeTracking.timer.running")}
          </Badge>
        )
    },
    {
      id: "billable",
      accessorFn: (entry) => (entry.billable ? "billable" : "nonBillable"),
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("timeTracking.fields.billable"),
        variant: "multiSelect",
        options: billableOptions,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("timeTracking.fields.billable")} />
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.billable ? "success" : "secondary"}>
          <Icon
            name={row.original.billable ? "CircleDollarSign" : "CircleSlash"}
            aria-hidden="true"
          />
          {t(`timeTracking.billable.${row.original.billable ? "billable" : "nonBillable"}`)}
        </Badge>
      )
    },
    {
      id: "invoiced",
      accessorFn: (entry) => (entry.invoicedInId ? "invoiced" : "unbilled"),
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("timeTracking.fields.invoiced"),
        variant: "multiSelect",
        options: invoicedOptions,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("timeTracking.fields.invoiced")} />
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.invoicedInId ? "secondary" : "warning"}>
          {t(`timeTracking.invoiced.${row.original.invoicedInId ? "invoiced" : "unbilled"}`)}
        </Badge>
      )
    },
    {
      id: "source",
      accessorFn: (entry) => entry.source,
      enableSorting: false,
      meta: {
        label: t("timeTracking.fields.source"),
        skeleton: <Skeleton className="h-5 w-16 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("timeTracking.fields.source")} />
      ),
      cell: ({ row }) => <TimeEntrySourceBadge source={row.original.source} />
    },
    {
      id: "amount",
      accessorFn: (entry) => entry.amountCents,
      enableSorting: false,
      meta: {
        align: "end",
        label: t("timeTracking.fields.amount"),
        skeleton: <Skeleton className="ml-auto h-3.5 w-20" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("timeTracking.fields.amount")} />
      ),
      cell: ({ row }) => (
        <span
          className={cn(
            "font-mono text-sm tabular-nums",
            row.original.billable ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          {formatCurrency(row.original.amountCents, row.original.currency, locale)}
        </span>
      )
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      meta: {
        headerClassName: "w-12",
        cellClassName: "text-right",
        skeleton: <Skeleton className="ml-auto size-7 rounded-md" />
      },
      cell: ({ row }) => {
        const entry = row.original
        const isEditable = !entry.invoicedInId && !entry.deletedAt && entry.endedAt !== null

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" label={t("timeTracking.list.actions")}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem disabled={!isEditable} onSelect={() => onEdit(entry)}>
                <Icon name="Pencil" aria-hidden="true" />
                {t("timeTracking.list.edit")}
              </DropdownMenuItem>
              {isEditable ? (
                <Fragment>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteIds([entry.id])}>
                    <Icon name="Trash2" aria-hidden="true" />
                    {t("timeTracking.actions.delete")}
                  </DropdownMenuItem>
                </Fragment>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
