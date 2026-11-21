"use client"

import Link from "next/link"

import { type TFunction } from "@/lib/i18n"

import { cn, formatCurrency } from "@/lib/utils"

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
import { isInvoiceEditable } from "../../services"
import { type InvoiceOverviewClientOption, type InvoiceOverviewItem } from "../../types"
import { getInvoiceDueDateColumn, getInvoiceIssueDateColumn } from "../invoiceColumns"
import { InvoiceStatusBadge } from "../InvoiceStatusBadge"

type InvoiceOverviewColumnsOptions = {
  t: TFunction
  locale: string
  clients: InvoiceOverviewClientOption[]
}

// The invoice detail surface lives under a project (`/projects/[projectId]/invoices/[invoiceId]`), so
// an invoice raised straight against a client, or one whose project reference was cleared, has no
// route to open. Those rows render their number as plain text rather than a link that would 404.
function getInvoiceHref(invoice: InvoiceOverviewItem): string | null {
  return invoice.projectId ? `/projects/${invoice.projectId}/invoices/${invoice.id}` : null
}

export function getInvoiceOverviewColumns({
  t,
  locale,
  clients
}: InvoiceOverviewColumnsOptions): ColumnDef<InvoiceOverviewItem>[] {
  const statusOptions = INVOICE_VIEW_STATUS_VALUES.map((value) => ({
    label: t(`invoices.status.${value}`),
    value
  }))

  const clientOptions = clients.map((client) => ({ label: client.name, value: client.id }))

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
      cell: ({ row }) => {
        const href = getInvoiceHref(row.original)

        return href ? (
          <Link href={href} className="font-mono text-sm font-medium hover:underline">
            {row.original.number}
          </Link>
        ) : (
          <span className="font-mono text-sm font-medium">{row.original.number}</span>
        )
      }
    },
    {
      id: "parent",
      accessorFn: (invoice) => invoice.parentLabel,
      meta: {
        label: t("invoices.overview.parentColumn"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("invoices.overview.parentColumn")} />
      ),
      cell: ({ row }) => {
        const invoice = row.original

        if (invoice.projectId) {
          return (
            <Link
              href={`/projects/${invoice.projectId}`}
              className="truncate text-sm font-medium hover:underline"
            >
              {invoice.parentLabel}
            </Link>
          )
        }

        if (invoice.clientId) {
          return (
            <Link
              href={`/clients/${invoice.clientId}`}
              className="truncate text-sm font-medium hover:underline"
            >
              {invoice.parentLabel}
            </Link>
          )
        }

        return (
          <span className="text-muted-foreground text-sm">{t("invoices.overview.noParent")}</span>
        )
      }
    },
    {
      id: "client",
      accessorFn: (invoice) => invoice.clientId,
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("invoices.overview.clientColumn"),
        variant: "multiSelect",
        options: clientOptions,
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("invoices.overview.clientColumn")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground truncate text-sm">
          {row.original.clientName || t("invoices.overview.noClient")}
        </span>
      )
    },
    {
      id: "status",
      accessorFn: (invoice) => invoice.viewStatus,
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
      cell: ({ row }) => <InvoiceStatusBadge status={row.original.viewStatus} />
    },
    getInvoiceIssueDateColumn<InvoiceOverviewItem>(t, locale),
    getInvoiceDueDateColumn<InvoiceOverviewItem>(t, locale),
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
        <span className="text-muted-foreground font-mono text-sm tabular-nums">
          {formatCurrency(row.original.totalCents, row.original.currency, locale)}
        </span>
      )
    },
    {
      id: "outstanding",
      accessorFn: (invoice) => invoice.outstandingCents,
      meta: {
        align: "end",
        label: t("invoices.overview.outstandingColumn"),
        skeleton: <Skeleton className="ml-auto h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("invoices.overview.outstandingColumn")} />
      ),
      cell: ({ row }) => (
        <span
          className={cn(
            "font-mono text-sm tabular-nums",
            row.original.outstandingCents > 0
              ? "text-foreground font-medium"
              : "text-muted-foreground"
          )}
        >
          {formatCurrency(row.original.outstandingCents, row.original.currency, locale)}
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
        const href = getInvoiceHref(invoice)

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" label={t("invoices.actions.rowActions")}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {href ? (
                <DropdownMenuItem asChild>
                  <Link href={href}>
                    <Icon name="ArrowRight" aria-hidden="true" />
                    {t("invoices.actions.view")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {href && isInvoiceEditable(invoice.status) ? (
                <DropdownMenuItem asChild>
                  <Link href={`${href}/edit`}>
                    <Icon name="Pencil" aria-hidden="true" />
                    {t("invoices.actions.edit")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {invoice.projectId ? (
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${invoice.projectId}`}>
                    <Icon name="FolderOpen" aria-hidden="true" />
                    {t("invoices.overview.openProject")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {invoice.clientId ? (
                <DropdownMenuItem asChild>
                  <Link href={`/clients/${invoice.clientId}`}>
                    <Icon name="Users" aria-hidden="true" />
                    {t("invoices.overview.openClient")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
