"use client"

import { useMemo } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Typography
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { type WebhookDeliveryListItem } from "../../types"

import { getWebhookDeliveryColumns } from "./deliveryColumns"

type WebhookDeliveriesTableProps = {
  deliveries: WebhookDeliveryListItem[]
  locale: string
  timeZone: string
}

const WebhookDeliveriesTable = ({ deliveries, locale, timeZone }: WebhookDeliveriesTableProps) => {
  const { t } = useTranslation()

  const columns = useMemo<ColumnDef<WebhookDeliveryListItem>[]>(
    () => getWebhookDeliveryColumns({ t, locale, timeZone }),
    [t, locale, timeZone]
  )

  const { table } = useDataTable({
    data: deliveries,
    columns,
    getRowId: (delivery) => delivery.id,
    enableRowSelection: false,
    columnVisibilityStorageKey: "webhook-deliveries:column-visibility",
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  return (
    <DataTable
      table={table}
      caption={t("settings.webhooks.deliveriesTitle")}
      empty={
        <Empty className="border-0 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon name="Inbox" />
            </EmptyMedia>
            <EmptyTitle>{t("settings.webhooks.deliveriesEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("settings.webhooks.deliveriesEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    >
      <div className="flex flex-col gap-0.5">
        <Typography affects={["small", "medium"]}>
          {t("settings.webhooks.deliveriesTitle")}
        </Typography>
        <Typography affects={["muted", "tiny"]}>
          {t("settings.webhooks.deliveriesDescription")}
        </Typography>
      </div>
    </DataTable>
  )
}

export { WebhookDeliveriesTable }
