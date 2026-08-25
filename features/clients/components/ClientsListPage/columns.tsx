"use client"

import { Fragment, type Dispatch, type SetStateAction } from "react"

import Link from "next/link"

import { type TFunction } from "@/lib/i18n"

import { cn, formatCurrency, formatDay } from "@/lib/utils"

import { resolveStorageUrl } from "@/lib/storage"

import {
  Badge,
  Checkbox,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EntityAvatar,
  Icon,
  IconButton,
  Skeleton,
  toast
} from "@/components/ui"

import { type ColumnDef } from "@/hooks"

import { CLIENT_HEALTH_VALUES } from "../../schemas"
import { type ClientListItem } from "../../types"
import { ClientHealthBadge } from "../ClientHealthBadge"

type CurrencyOption = {
  label: string
  value: string
}

export function getClientColumns(
  t: TFunction,
  locale: string,
  currencyOptions: CurrencyOption[],
  setDeleteIds: Dispatch<SetStateAction<string[]>>
): ColumnDef<ClientListItem>[] {
  const healthOptions = CLIENT_HEALTH_VALUES.map((value) => ({
    label: t(`clients.health.${value}`),
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
      accessorKey: "name",
      enableHiding: false,
      meta: {
        label: t("clients.fields.name"),
        skeleton: (
          <div className="flex items-center gap-3">
            <Skeleton className="size-6 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        )
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("clients.fields.name")} />
      ),
      cell: ({ row }) => {
        const client = row.original

        return (
          <div className="flex items-center gap-3">
            <EntityAvatar
              size="sm"
              name={client.name}
              src={resolveStorageUrl(client.imageStorageKey)}
              alt={t("clients.image.alt", { name: client.name })}
            />
            <div className="flex min-w-0 flex-col">
              {client.deletedAt ? (
                <span className="truncate font-medium">{client.name}</span>
              ) : (
                <Link
                  href={`/clients/${client.id}`}
                  className="truncate font-medium hover:underline"
                >
                  {client.name}
                </Link>
              )}
              <span className="text-muted-foreground truncate text-xs">{client.email}</span>
            </div>
          </div>
        )
      }
    },
    {
      accessorKey: "health",
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("clients.list.healthColumn"),
        variant: "multiSelect",
        options: healthOptions,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("clients.list.healthColumn")} />
      ),
      cell: ({ row }) => {
        const client = row.original

        return client.deletedAt ? (
          <Badge variant="outline">{t("clients.status.deleted")}</Badge>
        ) : (
          <ClientHealthBadge health={client.health} />
        )
      }
    },
    {
      accessorKey: "currency",
      enableColumnFilter: true,
      meta: {
        label: t("clients.fields.currency"),
        variant: "multiSelect",
        options: currencyOptions,
        skeleton: <Skeleton className="h-3.5 w-10" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("clients.fields.currency")} />
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.currency}</span>
    },
    {
      id: "joined",
      accessorFn: (client) => client.createdAt,
      enableColumnFilter: true,
      meta: {
        label: t("clients.list.joined"),
        variant: "date",
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("clients.list.joined")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDay(row.original.createdAt, locale)}
        </span>
      )
    },
    {
      id: "outstanding",
      accessorKey: "outstandingBalanceCents",
      enableColumnFilter: true,
      meta: {
        align: "end",
        label: t("clients.list.outstandingBalance"),
        variant: "range",
        skeleton: <Skeleton className="ml-auto h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("clients.list.outstandingBalance")} />
      ),
      cell: ({ row }) => {
        const client = row.original

        return (
          <span
            className={cn(
              "font-mono text-sm tabular-nums",
              client.outstandingBalanceCents > 0
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            {formatCurrency(client.outstandingBalanceCents, client.currency, locale)}
          </span>
        )
      }
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
        const client = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" label={t("clients.list.actions")}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!client.deletedAt ? (
                <DropdownMenuItem asChild>
                  <Link href={`/clients/${client.id}`}>
                    <Icon name="ArrowRight" aria-hidden="true" />
                    {t("clients.list.viewProfile")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onSelect={() => {
                  void navigator.clipboard
                    .writeText(client.email)
                    .then(() => toast.success(t("clients.list.emailCopied")))
                }}
              >
                <Icon name="Copy" aria-hidden="true" />
                {t("clients.list.copyEmail")}
              </DropdownMenuItem>
              {!client.deletedAt ? (
                <Fragment>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteIds([client.id])}
                  >
                    <Icon name="Trash2" aria-hidden="true" />
                    {t("clients.actions.delete")}
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
