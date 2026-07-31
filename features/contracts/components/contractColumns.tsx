"use client"

import Link from "next/link"

import { type TFunction } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

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

import { CONTRACT_STATUS_VALUES } from "../schemas"
import { isContractEditable } from "../services"
import { type ContractFilterOption, type ContractListItem } from "../types"

import { ContractStatusBadge } from "./ContractStatusBadge"

type ContractColumnsOptions = {
  t: TFunction
  locale: string
  clients: ContractFilterOption[]
}

// An effective window reads as a range because either end may be missing: a contract with only a
// start date is open-ended, and one with neither has not been dated at all.
function formatEffectiveWindow(contract: ContractListItem, t: TFunction, locale: string): string {
  if (!contract.effectiveFrom && !contract.effectiveUntil) {
    return t("contracts.table.noEffectiveRange")
  }

  const from = contract.effectiveFrom ? formatDay(contract.effectiveFrom, locale) : "—"
  const until = contract.effectiveUntil ? formatDay(contract.effectiveUntil, locale) : "—"

  return `${from} → ${until}`
}

export function getContractColumns({
  t,
  locale,
  clients
}: ContractColumnsOptions): ColumnDef<ContractListItem>[] {
  const clientOptions = clients.map((client) => ({ label: client.name, value: client.id }))
  const statusOptions = CONTRACT_STATUS_VALUES.map((value) => ({
    label: t(`contracts.status.${value}`),
    value
  }))

  return [
    {
      id: "number",
      accessorFn: (contract) => contract.number,
      enableHiding: false,
      meta: {
        label: t("contracts.table.numberColumn"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("contracts.table.numberColumn")} />
      ),
      cell: ({ row }) => (
        <Link
          href={`/contracts/${row.original.id}`}
          className="font-mono text-sm font-medium hover:underline"
        >
          {row.original.number}
        </Link>
      )
    },
    {
      id: "title",
      accessorFn: (contract) => contract.title,
      meta: {
        label: t("contracts.table.titleColumn"),
        skeleton: <Skeleton className="h-3.5 w-40" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("contracts.table.titleColumn")} />
      ),
      cell: ({ row }) => <span className="truncate text-sm font-medium">{row.original.title}</span>
    },
    {
      id: "parent",
      accessorFn: (contract) => contract.parentLabel,
      meta: {
        label: t("contracts.table.parentColumn"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("contracts.table.parentColumn")} />
      ),
      cell: ({ row }) => {
        const contract = row.original

        if (contract.projectId) {
          return (
            <Link
              href={`/projects/${contract.projectId}`}
              className="text-muted-foreground truncate text-sm hover:underline"
            >
              {contract.parentLabel}
            </Link>
          )
        }

        if (contract.clientId) {
          return (
            <Link
              href={`/clients/${contract.clientId}`}
              className="text-muted-foreground truncate text-sm hover:underline"
            >
              {contract.parentLabel}
            </Link>
          )
        }

        return (
          <span className="text-muted-foreground text-sm">{t("contracts.table.noParent")}</span>
        )
      }
    },
    {
      id: "client",
      accessorFn: (contract) => contract.clientId,
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("contracts.fields.client"),
        variant: "multiSelect",
        options: clientOptions,
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("contracts.fields.client")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground truncate text-sm">{row.original.parentLabel}</span>
      )
    },
    {
      id: "status",
      accessorFn: (contract) => contract.displayStatus,
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("contracts.table.statusColumn"),
        variant: "multiSelect",
        options: statusOptions,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("contracts.table.statusColumn")} />
      ),
      cell: ({ row }) => <ContractStatusBadge status={row.original.displayStatus} />
    },
    {
      id: "effective",
      accessorFn: (contract) => contract.effectiveFrom,
      meta: {
        label: t("contracts.table.effectiveColumn"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("contracts.table.effectiveColumn")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatEffectiveWindow(row.original, t, locale)}
        </span>
      )
    },
    {
      id: "created",
      accessorFn: (contract) => contract.createdAt,
      meta: {
        label: t("contracts.table.createdColumn"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("contracts.table.createdColumn")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDay(row.original.createdAt, locale)}
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
        const contract = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" label={t("contracts.actions.rowActions")}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href={`/contracts/${contract.id}`}>
                  <Icon name="ArrowRight" aria-hidden="true" />
                  {t("contracts.actions.view")}
                </Link>
              </DropdownMenuItem>
              {isContractEditable(contract.status) ? (
                <DropdownMenuItem asChild>
                  <Link href={`/contracts/${contract.id}/edit`}>
                    <Icon name="Pencil" aria-hidden="true" />
                    {t("contracts.actions.edit")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {contract.projectId ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${contract.projectId}`}>
                      <Icon name="FolderOpen" aria-hidden="true" />
                      {t("contracts.fields.project")}
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
