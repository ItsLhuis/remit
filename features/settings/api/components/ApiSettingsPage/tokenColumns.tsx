"use client"

import { type TFunction } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

import {
  Badge,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Skeleton,
  Typography
} from "@/components/ui"

import { type ColumnDef } from "@/hooks"

import { apiTokenScopeLabelKeys, apiTokenStatusPresentation } from "../../labels"
import { type ApiTokenListItem } from "../../types"

type ApiTokenColumnsOptions = {
  t: TFunction
  locale: string
  timeZone: string
  isBusy: boolean
  onRevoke: (token: ApiTokenListItem) => void
}

export function getApiTokenColumns({
  t,
  locale,
  timeZone,
  isBusy,
  onRevoke
}: ApiTokenColumnsOptions): ColumnDef<ApiTokenListItem>[] {
  return [
    {
      accessorKey: "name",
      enableHiding: false,
      meta: {
        label: t("settings.api.tableName"),
        skeleton: <Skeleton className="h-3.5 w-40" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.api.tableName")} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{row.original.name}</span>
          <Typography affects={["muted", "tiny"]} className="font-mono">
            {`${row.original.tokenPrefix}…`}
          </Typography>
        </div>
      )
    },
    {
      id: "scopes",
      enableSorting: false,
      meta: {
        label: t("settings.api.tableScopes"),
        skeleton: <Skeleton className="h-5 w-32 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.api.tableScopes")} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.scopes.map((scope) => (
            <Badge key={scope} variant="outline">
              {t(apiTokenScopeLabelKeys[scope])}
            </Badge>
          ))}
        </div>
      )
    },
    {
      accessorKey: "status",
      meta: {
        label: t("settings.api.tableStatus"),
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.api.tableStatus")} />
      ),
      cell: ({ row }) => {
        const presentation = apiTokenStatusPresentation[row.original.status]

        return (
          <Badge variant={presentation.variant}>
            <Icon name={presentation.icon} aria-hidden="true" />
            {t(`settings.api.status.${row.original.status}`)}
          </Badge>
        )
      }
    },
    {
      accessorKey: "lastUsedAt",
      meta: {
        label: t("settings.api.tableLastUsed"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.api.tableLastUsed")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.lastUsedAt
            ? formatDay(row.original.lastUsedAt, locale, timeZone)
            : t("settings.api.neverUsed")}
        </span>
      )
    },
    {
      accessorKey: "expiresAt",
      meta: {
        label: t("settings.api.tableExpires"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.api.tableExpires")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.expiresAt
            ? formatDay(row.original.expiresAt, locale, timeZone)
            : t("settings.api.noExpiry")}
        </span>
      )
    },
    {
      accessorKey: "createdAt",
      meta: {
        label: t("settings.api.tableCreated"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.api.tableCreated")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {formatDay(row.original.createdAt, locale, timeZone)}
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
        const token = row.original

        // A revoked or expired token has no menu: its only action is already taken or already
        // moot, and it stays in the list as a record of what existed.
        if (token.status !== "active") return null

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="ghost"
                size="icon-sm"
                label={t("settings.api.tableActions")}
                disabled={isBusy}
              >
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem variant="destructive" onSelect={() => onRevoke(token)}>
                <Icon name="Ban" aria-hidden="true" />
                {t("settings.api.revoke")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
