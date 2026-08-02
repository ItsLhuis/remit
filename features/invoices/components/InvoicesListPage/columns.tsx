"use client"

import Link from "next/link"

import { type TFunction } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import {
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

import { INVOICE_VIEW_STATUS_VALUES } from "../../schemas"
import { deriveInvoiceStatusView, isInvoiceEditable } from "../../services"
import { type InvoiceListItem } from "../../types"
import { InvoiceStatusBadge } from "../InvoiceStatusBadge"

type InvoiceColumnsOptions = {
  t: TFunction
  locale: string
  projectId: string
  now: Date
  onDelete: (id: string) => void
}

export function getInvoiceColumns({
  t,
  locale,
  projectId,
  now,
  onDelete
}: InvoiceColumnsOptions): ColumnDef<InvoiceListItem>[] {
  const statusOptions = INVOICE_VIEW_STATUS_VALUES.map((value) => ({
    label: t(`invoices.status.${value}`),
    value
  }))

  return [
    {
      accessorKey: "number",
      enableHiding: false,
      meta: {
        label: t("invoices.table.numberColumn"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("invoices.table.numberColumn")} />
      ),
      cell: ({ row }) => (
        <Link
          href={`/projects/${projectId}/invoices/${row.original.id}`}
          className="font-mono text-sm font-medium hover:underline"
        >
          {row.original.number}
        </Link>
      )
    },
    {
      id: "status",
      // The filter and the badge both read the derived view, so filtering by "overdue" selects the
      // rows the table actually shows as overdue even though no such value exists in the column.
      accessorFn: (invoice) => deriveInvoiceStatusView(invoice, now),
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("invoices.table.statusColumn"),
        variant: "multiSelect",
        options: statusOptions,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("invoices.table.statusColumn")} />
      ),
      cell: ({ row }) => <InvoiceStatusBadge status={deriveInvoiceStatusView(row.original, now)} />
    },
    {
      id: "issueDate",
      accessorFn: (invoice) => invoice.issueDate,
      enableColumnFilter: true,
      meta: {
        label: t("invoices.table.issueDateColumn"),
        variant: "date",
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("invoices.table.issueDateColumn")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.issueDate
            ? formatDay(row.original.issueDate, locale)
            : t("invoices.table.notIssued")}
        </span>
      )
    },
    {
      id: "dueDate",
      accessorFn: (invoice) => invoice.dueDate,
      enableColumnFilter: true,
      meta: {
        label: t("invoices.table.dueDateColumn"),
        variant: "date",
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("invoices.table.dueDateColumn")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.dueDate
            ? formatDay(row.original.dueDate, locale)
            : t("invoices.table.noDueDate")}
        </span>
      )
    },
    {
      id: "total",
      accessorFn: (invoice) => invoice.totalCents,
      enableColumnFilter: true,
      meta: {
        align: "end",
        label: t("invoices.table.totalColumn"),
        variant: "range",
        skeleton: <Skeleton className="ml-auto h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("invoices.table.totalColumn")} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium tabular-nums">
          {formatCurrency(row.original.totalCents, row.original.currency, locale)}
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
        const invoice = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" label={t("invoices.actions.rowActions")}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/projects/${projectId}/invoices/${invoice.id}`}>
                  <Icon name="ArrowRight" aria-hidden="true" />
                  {t("invoices.actions.view")}
                </Link>
              </DropdownMenuItem>
              {isInvoiceEditable(invoice.status) ? (
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${projectId}/invoices/${invoice.id}/edit`}>
                    <Icon name="Pencil" aria-hidden="true" />
                    {t("invoices.actions.edit")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(invoice.id)}>
                <Icon name="Trash2" aria-hidden="true" />
                {t("invoices.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
