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

import { type CreditNoteOverviewClientOption, type CreditNoteOverviewItem } from "../../types"

type CreditNoteOverviewColumnsOptions = {
  t: TFunction
  locale: string
  clients: CreditNoteOverviewClientOption[]
}

// Every credit-note route is nested under the project-scoped invoice route
// (`/projects/[projectId]/invoices/[invoiceId]/credit-notes/[creditNoteId]`), so a note whose invoice
// was raised straight against a client, or whose project reference was cleared, has no route to open.
// Those rows render as plain text rather than a link that would 404.
function getCreditNoteHref(creditNote: CreditNoteOverviewItem): string | null {
  return creditNote.projectId
    ? `/projects/${creditNote.projectId}/invoices/${creditNote.invoiceId}/credit-notes/${creditNote.id}`
    : null
}

function getInvoiceHref(creditNote: CreditNoteOverviewItem): string | null {
  return creditNote.projectId
    ? `/projects/${creditNote.projectId}/invoices/${creditNote.invoiceId}`
    : null
}

export function getCreditNoteOverviewColumns({
  t,
  locale,
  clients
}: CreditNoteOverviewColumnsOptions): ColumnDef<CreditNoteOverviewItem>[] {
  const clientOptions = clients.map((client) => ({ label: client.name, value: client.id }))

  return [
    {
      id: "number",
      accessorFn: (creditNote) => creditNote.number,
      enableHiding: false,
      meta: {
        label: t("creditNotes.overview.numberColumn"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("creditNotes.overview.numberColumn")} />
      ),
      cell: ({ row }) => {
        const href = getCreditNoteHref(row.original)

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
      id: "invoice",
      accessorFn: (creditNote) => creditNote.invoiceNumber,
      meta: {
        label: t("creditNotes.overview.invoiceColumn"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("creditNotes.overview.invoiceColumn")} />
      ),
      cell: ({ row }) => {
        const href = getInvoiceHref(row.original)

        return href ? (
          <Link href={href} className="font-mono text-sm hover:underline">
            {row.original.invoiceNumber}
          </Link>
        ) : (
          <span className="font-mono text-sm">{row.original.invoiceNumber}</span>
        )
      }
    },
    {
      id: "client",
      accessorFn: (creditNote) => creditNote.clientId,
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("creditNotes.overview.clientColumn"),
        variant: "multiSelect",
        options: clientOptions,
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("creditNotes.overview.clientColumn")} />
      ),
      cell: ({ row }) =>
        row.original.clientId ? (
          <Link
            href={`/clients/${row.original.clientId}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {row.original.clientName}
          </Link>
        ) : (
          <span className="text-muted-foreground truncate text-sm">
            {t("creditNotes.overview.noClient")}
          </span>
        )
    },
    {
      id: "issuedAt",
      accessorFn: (creditNote) => creditNote.issuedAt,
      enableColumnFilter: true,
      meta: {
        label: t("creditNotes.overview.issuedColumn"),
        variant: "date",
        skeleton: <Skeleton className="h-3.5 w-20" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("creditNotes.overview.issuedColumn")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDay(row.original.issuedAt, locale)}
        </span>
      )
    },
    {
      id: "total",
      accessorFn: (creditNote) => creditNote.totalCents,
      enableColumnFilter: true,
      meta: {
        align: "end",
        label: t("creditNotes.overview.totalColumn"),
        variant: "range",
        skeleton: <Skeleton className="ml-auto h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("creditNotes.overview.totalColumn")} />
      ),
      // Signed negative: a credit note only ever reduces a receivable, and printing it unsigned in a
      // column beside invoice totals would read as money owed.
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium tabular-nums">
          {formatCurrency(-row.original.totalCents, row.original.currency, locale)}
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
        const creditNote = row.original
        const href = getCreditNoteHref(creditNote)
        const invoiceHref = getInvoiceHref(creditNote)

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="ghost"
                size="icon-sm"
                label={t("creditNotes.overview.rowActions")}
              >
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {href ? (
                <DropdownMenuItem asChild>
                  <Link href={href}>
                    <Icon name="ArrowRight" aria-hidden="true" />
                    {t("creditNotes.actions.view")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {invoiceHref ? (
                <DropdownMenuItem asChild>
                  <Link href={invoiceHref}>
                    <Icon name="Receipt" aria-hidden="true" />
                    {t("creditNotes.overview.openInvoice")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {creditNote.clientId ? <DropdownMenuSeparator /> : null}
              {creditNote.clientId ? (
                <DropdownMenuItem asChild>
                  <Link href={`/clients/${creditNote.clientId}`}>
                    <Icon name="Users" aria-hidden="true" />
                    {t("creditNotes.overview.openClient")}
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
