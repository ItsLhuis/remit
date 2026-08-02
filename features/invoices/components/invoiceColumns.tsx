"use client"

import { type TFunction } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

import { DataTableColumnHeader, Skeleton } from "@/components/ui"

import { type ColumnDef } from "@/hooks"

// The date columns both invoice tables render identically. They are shared rather than duplicated so
// a change to how an issue or due date reads applies to the project-scoped list and the instance-wide
// overview at once. Each factory is generic over the row model and constrains only the field it
// renders, so neither table has to adopt the other's read model. The money and status columns are
// deliberately not here: the two surfaces weight totals differently and derive the status badge from
// different fields.

export function getInvoiceIssueDateColumn<TRow extends { issueDate: Date | null }>(
  t: TFunction,
  locale: string
): ColumnDef<TRow> {
  return {
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
  }
}

export function getInvoiceDueDateColumn<TRow extends { dueDate: Date | null }>(
  t: TFunction,
  locale: string
): ColumnDef<TRow> {
  return {
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
  }
}
