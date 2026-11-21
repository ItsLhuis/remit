"use client"

import Link from "next/link"

import { type TFunction } from "@/lib/i18n"

import { formatDate } from "@/lib/utils"

import {
  Badge,
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

import { recurringInvoiceStatusPresentation } from "../../labels"
import {
  RECURRING_INVOICE_CADENCE_VALUES,
  RECURRING_INVOICE_STATUS_VALUES,
  type RecurringInvoiceStatus
} from "../../schemas"
import { canTransitionRecurringInvoiceStatus } from "../../services"
import { type RecurringInvoiceClientOption, type RecurringInvoiceListItem } from "../../types"

export type RecurringInvoiceRowAction = "pause" | "resume" | "cancel" | "delete"

export type RecurringInvoiceRowActionTarget = {
  action: RecurringInvoiceRowAction
  id: string
}

type RecurringInvoiceOverviewColumnsOptions = {
  t: TFunction
  locale: string
  timeZone: string
  clients: RecurringInvoiceClientOption[]
  onAction: (target: RecurringInvoiceRowActionTarget) => void
}

// `updateRecurringInvoice` in mutations.ts refuses a terminal schedule: editing one would rewrite the
// terms past invoices were raised under while producing no future ones. The menu hides the entry
// rather than offering an edit the server would reject.
function isRecurringInvoiceEditable(status: RecurringInvoiceStatus): boolean {
  return status !== "completed" && status !== "cancelled"
}

// The column ids are the contract `parseRecurringInvoiceOverviewQuery` in schemas.ts reads: it names
// its filter parameters `client`, `status` and `cadence`, and its sort ids `name`, `client`,
// `cadence`, `nextRunAt` and `status`. Renaming a column here without renaming it there drops that
// filter or sort on the server with nothing failing.
export function getRecurringInvoiceOverviewColumns({
  t,
  locale,
  timeZone,
  clients,
  onAction
}: RecurringInvoiceOverviewColumnsOptions): ColumnDef<RecurringInvoiceListItem>[] {
  const clientOptions = clients.map((client) => ({ label: client.name, value: client.id }))

  const statusOptions = RECURRING_INVOICE_STATUS_VALUES.map((value) => ({
    label: t(`recurringInvoices.status.${value}`),
    value
  }))

  const cadenceOptions = RECURRING_INVOICE_CADENCE_VALUES.map((value) => ({
    label: t(`recurringInvoices.cadence.${value}`),
    value
  }))

  return [
    {
      id: "name",
      accessorFn: (schedule) => schedule.name,
      enableHiding: false,
      meta: {
        label: t("recurringInvoices.list.columns.name"),
        skeleton: <Skeleton className="h-3.5 w-40" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("recurringInvoices.list.columns.name")} />
      ),
      cell: ({ row }) => (
        <Link
          href={`/recurring-invoices/${row.original.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {row.original.name}
        </Link>
      )
    },
    {
      id: "client",
      accessorFn: (schedule) => schedule.clientId,
      enableColumnFilter: true,
      meta: {
        label: t("recurringInvoices.list.columns.client"),
        variant: "multiSelect",
        options: clientOptions,
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("recurringInvoices.list.columns.client")} />
      ),
      cell: ({ row }) => (
        <Link
          href={`/clients/${row.original.clientId}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {row.original.clientName}
        </Link>
      )
    },
    {
      id: "project",
      accessorFn: (schedule) => schedule.projectName,
      enableSorting: false,
      meta: {
        label: t("recurringInvoices.list.columns.project"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("recurringInvoices.list.columns.project")}
        />
      ),
      cell: ({ row }) =>
        row.original.projectName ? (
          <span className="truncate text-sm">{row.original.projectName}</span>
        ) : (
          <span className="text-muted-foreground truncate text-sm">
            {t("recurringInvoices.detail.noProject")}
          </span>
        )
    },
    {
      id: "cadence",
      accessorFn: (schedule) => schedule.cadence,
      enableColumnFilter: true,
      meta: {
        label: t("recurringInvoices.list.columns.cadence"),
        variant: "multiSelect",
        options: cadenceOptions,
        skeleton: <Skeleton className="h-3.5 w-20" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("recurringInvoices.list.columns.cadence")}
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {t(`recurringInvoices.cadence.${row.original.cadence}`)}
        </span>
      )
    },
    {
      id: "nextRunAt",
      accessorFn: (schedule) => schedule.nextRunAt,
      meta: {
        label: t("recurringInvoices.list.columns.nextRun"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("recurringInvoices.list.columns.nextRun")}
        />
      ),
      // The run instant is stored in UTC and swept by the nightly job, so it is shown in the
      // instance's time zone rather than the viewer's: a schedule that reads "tomorrow 00:00" here
      // must be the same day the job will pick it up.
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(row.original.nextRunAt, { locale, timeZone })}
        </span>
      )
    },
    {
      id: "status",
      accessorFn: (schedule) => schedule.status,
      enableColumnFilter: true,
      meta: {
        label: t("recurringInvoices.list.columns.status"),
        variant: "multiSelect",
        options: statusOptions,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("recurringInvoices.list.columns.status")} />
      ),
      cell: ({ row }) => {
        const presentation = recurringInvoiceStatusPresentation[row.original.status]

        return (
          <Badge variant={presentation.variant}>
            <Icon name={presentation.icon} aria-hidden="true" />
            {t(`recurringInvoices.status.${row.original.status}`)}
          </Badge>
        )
      }
    },
    {
      id: "occurrences",
      accessorFn: (schedule) => schedule.occurrencesGenerated,
      enableSorting: false,
      meta: {
        align: "end",
        label: t("recurringInvoices.list.columns.occurrences"),
        skeleton: <Skeleton className="ml-auto h-3.5 w-10" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("recurringInvoices.list.columns.occurrences")}
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-sm tabular-nums">
          {row.original.occurrencesGenerated}
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
        const schedule = row.original
        const canPause = canTransitionRecurringInvoiceStatus(schedule.status, "paused").allowed
        const canResume = canTransitionRecurringInvoiceStatus(schedule.status, "active").allowed
        const canCancel = canTransitionRecurringInvoiceStatus(schedule.status, "cancelled").allowed

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="ghost"
                size="icon-sm"
                label={t("recurringInvoices.list.moreActions")}
              >
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {isRecurringInvoiceEditable(schedule.status) ? (
                <DropdownMenuItem asChild>
                  <Link href={`/recurring-invoices/${schedule.id}/edit`}>
                    <Icon name="Pencil" aria-hidden="true" />
                    {t("common.actions.edit")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {canPause ? (
                <DropdownMenuItem onSelect={() => onAction({ action: "pause", id: schedule.id })}>
                  <Icon name="Pause" aria-hidden="true" />
                  {t("recurringInvoices.dialogs.pause.confirm")}
                </DropdownMenuItem>
              ) : null}
              {canResume ? (
                <DropdownMenuItem onSelect={() => onAction({ action: "resume", id: schedule.id })}>
                  <Icon name="Play" aria-hidden="true" />
                  {t("recurringInvoices.dialogs.resume.confirm")}
                </DropdownMenuItem>
              ) : null}
              {canCancel ? (
                <DropdownMenuItem onSelect={() => onAction({ action: "cancel", id: schedule.id })}>
                  <Icon name="CircleSlash" aria-hidden="true" />
                  {t("recurringInvoices.dialogs.cancel.confirm")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onAction({ action: "delete", id: schedule.id })}
              >
                <Icon name="Trash2" aria-hidden="true" />
                {t("recurringInvoices.dialogs.delete.confirm")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
