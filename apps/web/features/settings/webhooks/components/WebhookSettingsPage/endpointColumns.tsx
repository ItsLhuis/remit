"use client"

import { type TFunction } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

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

import { webhookEndpointStatusPresentation } from "../../labels"
import { type WebhookEndpointListItem } from "../../types"

type WebhookEndpointColumnsOptions = {
  t: TFunction
  locale: string
  timeZone: string
  isBusy: boolean
  onSendTest: (endpoint: WebhookEndpointListItem) => void
  onToggleActive: (endpoint: WebhookEndpointListItem) => void
  onRotateSecret: (endpoint: WebhookEndpointListItem) => void
  onDelete: (endpoint: WebhookEndpointListItem) => void
}

export function getWebhookEndpointColumns({
  t,
  locale,
  timeZone,
  isBusy,
  onSendTest,
  onToggleActive,
  onRotateSecret,
  onDelete
}: WebhookEndpointColumnsOptions): ColumnDef<WebhookEndpointListItem>[] {
  return [
    {
      accessorKey: "url",
      enableHiding: false,
      meta: {
        label: t("settings.webhooks.tableUrl"),
        skeleton: <Skeleton className="h-3.5 w-56" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.webhooks.tableUrl")} />
      ),
      cell: ({ row }) => (
        <span className="block max-w-80 truncate font-mono text-xs" title={row.original.url}>
          {row.original.url}
        </span>
      )
    },
    {
      id: "events",
      enableSorting: false,
      meta: {
        label: t("settings.webhooks.tableEvents"),
        skeleton: <Skeleton className="h-3.5 w-16" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.webhooks.tableEvents")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {t("settings.webhooks.eventsCount", { count: row.original.events.length })}
        </span>
      )
    },
    {
      accessorKey: "status",
      meta: {
        label: t("settings.webhooks.tableStatus"),
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.webhooks.tableStatus")} />
      ),
      cell: ({ row }) => {
        const presentation = webhookEndpointStatusPresentation[row.original.status]

        return (
          <Badge variant={presentation.variant}>
            <Icon name={presentation.icon} aria-hidden="true" />
            {t(`settings.webhooks.status.${row.original.status}`)}
          </Badge>
        )
      }
    },
    {
      accessorKey: "createdAt",
      meta: {
        label: t("settings.webhooks.tableCreated"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.webhooks.tableCreated")} />
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
        const endpoint = row.original
        const isActive = endpoint.status === "active"

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="ghost"
                size="icon-sm"
                label={t("settings.webhooks.tableActions")}
                disabled={isBusy}
              >
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled={!isActive} onSelect={() => onSendTest(endpoint)}>
                <Icon name="Send" aria-hidden="true" />
                {t("settings.webhooks.actions.sendTest")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onToggleActive(endpoint)}>
                <Icon name={isActive ? "CirclePause" : "CirclePlay"} aria-hidden="true" />
                {isActive
                  ? t("settings.webhooks.actions.disable")
                  : t("settings.webhooks.actions.enable")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onRotateSecret(endpoint)}>
                <Icon name="RefreshCw" aria-hidden="true" />
                {t("settings.webhooks.actions.rotateSecret")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(endpoint)}>
                <Icon name="Trash2" aria-hidden="true" />
                {t("settings.webhooks.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
