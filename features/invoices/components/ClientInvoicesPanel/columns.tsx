"use client"

import Link from "next/link"

import { type TFunction } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { DataTableColumnHeader, Skeleton } from "@/components/ui"

import { type ColumnDef } from "@/hooks"

import { INVOICE_VIEW_STATUS_VALUES } from "../../schemas"
import { deriveInvoiceStatusView, getInvoiceOutstandingCents } from "../../services"
import { type InvoiceListItem } from "../../types"
import { getInvoiceDueDateColumn, getInvoiceIssueDateColumn } from "../invoiceColumns"
import { InvoiceStatusBadge } from "../InvoiceStatusBadge"

type ClientInvoiceColumnsOptions = {
  t: TFunction
  locale: string
  now: Date
}

export function getClientInvoiceColumns({
  t,
  locale,
  now
}: ClientInvoiceColumnsOptions): ColumnDef<InvoiceListItem>[] {
  const statusOptions = INVOICE_VIEW_STATUS_VALUES.map((value) => ({
    label: t(`invoices.status.${value}`),
    value
  }))

  return [
    {
      id: "number",
      accessorFn: (invoice) => invoice.number,
      enableHiding: false,
      meta: {
        label: t("invoices.table.numberColumn"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("invoices.table.numberColumn")} />
      ),
      // The invoice detail surface lives under a project, so an invoice raised straight against the
      // client has no route to open and renders as plain text — the same rule
      // `InvoicesOverviewPage/columns.tsx` applies for the same reason.
      cell: ({ row }) =>
        row.original.projectId ? (
          <Link
            href={`/projects/${row.original.projectId}/invoices/${row.original.id}`}
            className="font-mono text-sm font-medium hover:underline"
          >
            {row.original.number}
          </Link>
        ) : (
          <span className="font-mono text-sm font-medium">{row.original.number}</span>
        )
    },
    {
      id: "status",
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
    getInvoiceIssueDateColumn<InvoiceListItem>(t, locale),
    getInvoiceDueDateColumn<InvoiceListItem>(t, locale),
    {
      id: "total",
      accessorFn: (invoice) => invoice.totalCents,
      meta: {
        align: "end",
        label: t("invoices.table.totalColumn"),
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
      id: "outstanding",
      accessorFn: (invoice) => getInvoiceOutstandingCents(invoice),
      meta: {
        align: "end",
        label: t("invoices.clientPanel.outstandingColumn"),
        skeleton: <Skeleton className="ml-auto h-3.5 w-20" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("invoices.clientPanel.outstandingColumn")}
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-sm tabular-nums">
          {formatCurrency(getInvoiceOutstandingCents(row.original), row.original.currency, locale)}
        </span>
      )
    }
  ]
}
