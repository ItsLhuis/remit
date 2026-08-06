"use client"

import { Fragment, type Dispatch, type SetStateAction } from "react"

import { type TFunction } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

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

import { EXPENSE_INVOICED_VALUES, EXPENSE_REBILLABLE_VALUES } from "../../schemas"
import { type ExpenseListItem } from "../../types"
import { ExpenseReceiptLink } from "../ExpenseReceiptLink"

type FilterOption = {
  label: string
  value: string
}

type ExpenseColumnsOptions = {
  t: TFunction
  locale: string
  projectOptions: FilterOption[]
  clientOptions: FilterOption[]
  categoryOptions: FilterOption[]
  currencyOptions: FilterOption[]
  onEdit: (expense: ExpenseListItem) => void
  setDeleteIds: Dispatch<SetStateAction<string[]>>
}

export function getExpenseColumns({
  t,
  locale,
  projectOptions,
  clientOptions,
  categoryOptions,
  currencyOptions,
  onEdit,
  setDeleteIds
}: ExpenseColumnsOptions): ColumnDef<ExpenseListItem>[] {
  const rebillableOptions = EXPENSE_REBILLABLE_VALUES.map((value) => ({
    label: t(`expenses.rebillable.${value}`),
    value
  }))

  const invoicedOptions = EXPENSE_INVOICED_VALUES.map((value) => ({
    label: t(`expenses.invoiced.${value}`),
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
      id: "spentAt",
      accessorFn: (expense) => expense.spentAt,
      enableColumnFilter: true,
      meta: {
        label: t("expenses.fields.spentAt"),
        variant: "date",
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("expenses.fields.spentAt")} />
      ),
      // "UTC" because `expenses.spent_at` is a calendar day, not an instant: formatting it in the
      // reader's zone would print the previous day anywhere west of Greenwich.
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDay(row.original.spentAt, locale, "UTC")}
        </span>
      )
    },
    {
      id: "category",
      accessorFn: (expense) => expense.category,
      enableSorting: true,
      enableColumnFilter: true,
      enableHiding: false,
      meta: {
        label: t("expenses.fields.category"),
        variant: "multiSelect",
        options: categoryOptions,
        skeleton: (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
        )
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("expenses.fields.category")} />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.original.category}</span>
          <span className="text-muted-foreground truncate text-xs">{row.original.description}</span>
        </div>
      )
    },
    {
      id: "project",
      accessorFn: (expense) => expense.projectId ?? "",
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("expenses.fields.project"),
        variant: "multiSelect",
        options: projectOptions,
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("expenses.fields.project")} />
      ),
      cell: ({ row }) => (
        <span className="truncate text-sm">
          {row.original.projectName ?? t("expenses.fields.noProject")}
        </span>
      )
    },
    {
      id: "client",
      accessorFn: (expense) => expense.clientId ?? "",
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("expenses.fields.client"),
        variant: "multiSelect",
        options: clientOptions,
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("expenses.fields.client")} />
      ),
      cell: ({ row }) => (
        <span className="truncate text-sm">
          {row.original.clientName ?? t("expenses.fields.noClient")}
        </span>
      )
    },
    {
      id: "amount",
      accessorFn: (expense) => expense.amountCents,
      meta: {
        align: "end",
        label: t("expenses.fields.amount"),
        skeleton: <Skeleton className="ml-auto h-3.5 w-20" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("expenses.fields.amount")} />
      ),
      cell: ({ row }) => (
        <span className="text-foreground font-mono text-sm font-medium tabular-nums">
          {formatCurrency(row.original.amountCents, row.original.currency, locale)}
        </span>
      )
    },
    {
      id: "currency",
      accessorFn: (expense) => expense.currency,
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("expenses.fields.currency"),
        variant: "multiSelect",
        options: currencyOptions,
        skeleton: <Skeleton className="h-3.5 w-10" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("expenses.fields.currency")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-xs">{row.original.currency}</span>
      )
    },
    {
      id: "rebillable",
      accessorFn: (expense) => (expense.rebillable ? "rebillable" : "nonRebillable"),
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("expenses.fields.rebillable"),
        variant: "multiSelect",
        options: rebillableOptions,
        skeleton: <Skeleton className="h-5 w-24 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("expenses.fields.rebillable")} />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <Badge variant={row.original.rebillable ? "success" : "secondary"}>
            <Icon
              name={row.original.rebillable ? "CircleDollarSign" : "CircleSlash"}
              aria-hidden="true"
            />
            {t(`expenses.rebillable.${row.original.rebillable ? "rebillable" : "nonRebillable"}`)}
          </Badge>
          {row.original.rebillable && row.original.markupPercentage !== null ? (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {t("expenses.list.rebillsAt", {
                markup: row.original.markupPercentage,
                amount: formatCurrency(row.original.rebillableCents, row.original.currency, locale)
              })}
            </span>
          ) : null}
        </div>
      )
    },
    {
      id: "invoiced",
      accessorFn: (expense) => (expense.invoicedInId ? "invoiced" : "unbilled"),
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("expenses.fields.invoiced"),
        variant: "multiSelect",
        options: invoicedOptions,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("expenses.fields.invoiced")} />
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.invoicedInId ? "secondary" : "warning"}>
          {t(`expenses.invoiced.${row.original.invoicedInId ? "invoiced" : "unbilled"}`)}
        </Badge>
      )
    },
    {
      id: "receipt",
      accessorFn: (expense) => expense.receipt?.filename ?? "",
      enableSorting: false,
      meta: {
        label: t("expenses.fields.receipt"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("expenses.fields.receipt")} />
      ),
      cell: ({ row }) =>
        row.original.receipt ? (
          <ExpenseReceiptLink
            filename={row.original.receipt.filename}
            objectKey={row.original.receipt.path}
            className="max-w-40"
          />
        ) : (
          <span className="text-muted-foreground text-sm">{t("expenses.receipt.none")}</span>
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
        const expense = row.original
        const isEditable = !expense.invoicedInId && !expense.deletedAt

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" label={t("expenses.list.actions")}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem disabled={!isEditable} onSelect={() => onEdit(expense)}>
                <Icon name="Pencil" aria-hidden="true" />
                {t("expenses.list.edit")}
              </DropdownMenuItem>
              {isEditable ? (
                <Fragment>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteIds([expense.id])}
                  >
                    <Icon name="Trash2" aria-hidden="true" />
                    {t("expenses.actions.delete")}
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
