"use client"

import { type TFunction } from "@/lib/i18n"

import { formatPercentage } from "@/lib/utils"

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

import { type TaxRateListItem } from "../../schemas"

type TaxRateColumnsOptions = {
  t: TFunction
  isBusy: boolean
  onEdit: (taxRate: TaxRateListItem) => void
  onSetDefault: (taxRate: TaxRateListItem) => void
  onDelete: (taxRate: TaxRateListItem) => void
}

export function getTaxRateColumns({
  t,
  isBusy,
  onEdit,
  onSetDefault,
  onDelete
}: TaxRateColumnsOptions): ColumnDef<TaxRateListItem>[] {
  return [
    {
      accessorKey: "name",
      enableHiding: false,
      meta: {
        label: t("settings.taxRates.tableName"),
        skeleton: <Skeleton className="h-3.5 w-40" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.taxRates.tableName")} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>
    },
    {
      accessorKey: "percentage",
      meta: {
        align: "end",
        label: t("settings.taxRates.tableRate"),
        skeleton: <Skeleton className="ml-auto h-3.5 w-16" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.taxRates.tableRate")} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums">
          {t("settings.taxRates.percentageValue", {
            percentage: formatPercentage(row.original.percentage)
          })}
        </span>
      )
    },
    {
      id: "status",
      accessorFn: (taxRate) => taxRate.isDefault,
      enableSorting: false,
      meta: {
        label: t("settings.taxRates.tableStatus"),
        skeleton: <Skeleton className="h-5 w-24 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.taxRates.tableStatus")} />
      ),
      cell: ({ row }) =>
        row.original.isDefault ? (
          <Badge variant="success">
            <Icon name="BadgeCheck" aria-hidden="true" />
            {t("settings.taxRates.defaultBadge")}
          </Badge>
        ) : (
          <Badge variant="secondary">{t("settings.taxRates.notDefaultBadge")}</Badge>
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
        const taxRate = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="ghost"
                size="icon-sm"
                label={t("settings.taxRates.tableActions")}
                disabled={isBusy}
              >
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => onEdit(taxRate)}>
                <Icon name="Pencil" aria-hidden="true" />
                {t("settings.taxRates.editRate")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={taxRate.isDefault} onSelect={() => onSetDefault(taxRate)}>
                <Icon name="BadgeCheck" aria-hidden="true" />
                {t("settings.taxRates.makeDefault")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(taxRate)}>
                <Icon name="Trash2" aria-hidden="true" />
                {t("settings.taxRates.deleteRate")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
