"use client"

import { type TFunction } from "@/lib/i18n"

import { formatDate } from "@/lib/utils"

import { Badge, DataTableColumnHeader, Icon, Skeleton } from "@/components/ui"

import { isWebhookEvent, WEBHOOK_TEST_EVENT } from "@/features/webhooks"

import { type ColumnDef } from "@/hooks"

import { webhookDeliveryStatusPresentation } from "../../labels"
import { type WebhookDeliveryListItem } from "../../types"

function getDeliveryEventLabel(event: string, t: TFunction): string {
  if (event === WEBHOOK_TEST_EVENT) return t("settings.webhooks.testEvent")

  return isWebhookEvent(event) ? t(`settings.webhooks.events.${event}`) : event
}

function getEndpointHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

type WebhookDeliveryColumnsOptions = {
  t: TFunction
  locale: string
  timeZone: string
}

export function getWebhookDeliveryColumns({
  t,
  locale,
  timeZone
}: WebhookDeliveryColumnsOptions): ColumnDef<WebhookDeliveryListItem>[] {
  return [
    {
      accessorKey: "event",
      enableHiding: false,
      meta: {
        label: t("settings.webhooks.tableEvent"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.webhooks.tableEvent")} />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{getDeliveryEventLabel(row.original.event, t)}</span>
      )
    },
    {
      accessorKey: "endpointUrl",
      meta: {
        label: t("settings.webhooks.tableEndpoint"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.webhooks.tableEndpoint")} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{getEndpointHost(row.original.endpointUrl)}</span>
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
        const presentation = webhookDeliveryStatusPresentation[row.original.status]

        return (
          <Badge variant={presentation.variant}>
            <Icon name={presentation.icon} aria-hidden="true" />
            {t(`settings.webhooks.deliveryStatus.${row.original.status}`)}
          </Badge>
        )
      }
    },
    {
      accessorKey: "attemptCount",
      meta: {
        label: t("settings.webhooks.tableAttempts"),
        skeleton: <Skeleton className="h-3.5 w-8" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.webhooks.tableAttempts")} />
      ),
      cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.attemptCount}</span>
    },
    {
      accessorKey: "lastStatusCode",
      meta: {
        label: t("settings.webhooks.tableResponse"),
        skeleton: <Skeleton className="h-3.5 w-10" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.webhooks.tableResponse")} />
      ),
      cell: ({ row }) =>
        row.original.lastStatusCode === null ? (
          <span className="text-muted-foreground text-sm">{t("settings.webhooks.noResponse")}</span>
        ) : (
          <span className="font-mono text-sm">{row.original.lastStatusCode}</span>
        )
    },
    {
      accessorKey: "createdAt",
      meta: {
        label: t("settings.webhooks.tableTime"),
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.webhooks.tableTime")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {formatDate(row.original.createdAt, { locale, timeZone })}
        </span>
      )
    }
  ]
}
