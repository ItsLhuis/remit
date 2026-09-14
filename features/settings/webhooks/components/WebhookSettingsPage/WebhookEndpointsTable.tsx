"use client"

import { Fragment, useEffect, useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  ConfirmDialog,
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Typography,
  toast
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import {
  deleteWebhookEndpoint,
  rotateWebhookEndpointSecret,
  sendWebhookTest,
  setWebhookEndpointActive
} from "../../mutations"
import { type WebhookEndpointListItem } from "../../types"

import { CreateWebhookDialog } from "./CreateWebhookDialog"
import { getWebhookEndpointColumns } from "./endpointColumns"
import { WebhookSecretDialog } from "./WebhookSecretDialog"

type ActiveDialog =
  | { kind: "create" }
  | { kind: "rotate"; endpoint: WebhookEndpointListItem }
  | { kind: "delete"; endpoint: WebhookEndpointListItem }
  | { kind: "secret"; secret: string }
  | null

type WebhookEndpointsTableProps = {
  initialEndpoints: WebhookEndpointListItem[]
  locale: string
  timeZone: string
}

const WebhookEndpointsTable = ({
  initialEndpoints,
  locale,
  timeZone
}: WebhookEndpointsTableProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [endpoints, setEndpoints] = useState(initialEndpoints)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)

  const [isPending, startTransition] = useTransition()

  const rotateTarget = activeDialog?.kind === "rotate" ? activeDialog.endpoint : null
  const deleteTarget = activeDialog?.kind === "delete" ? activeDialog.endpoint : null
  const revealedSecret = activeDialog?.kind === "secret" ? activeDialog.secret : null

  const onSendTest = (endpoint: WebhookEndpointListItem) => {
    startTransition(async () => {
      const result = await sendWebhookTest({ endpointId: endpoint.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("settings.webhooks.testQueued"))

      router.refresh()
    })
  }

  const onToggleActive = (endpoint: WebhookEndpointListItem) => {
    startTransition(async () => {
      const result = await setWebhookEndpointActive({
        endpointId: endpoint.id,
        active: endpoint.status !== "active"
      })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setEndpoints((current) =>
        current.map((existing) =>
          existing.id === result.data.endpoint.id ? result.data.endpoint : existing
        )
      )

      toast.success(
        result.data.endpoint.status === "active"
          ? t("settings.webhooks.enabled")
          : t("settings.webhooks.disabled")
      )

      router.refresh()
    })
  }

  const columns = useMemo<ColumnDef<WebhookEndpointListItem>[]>(
    () =>
      getWebhookEndpointColumns({
        t,
        locale,
        timeZone,
        isBusy: isPending,
        onSendTest,
        onToggleActive,
        onRotateSecret: (endpoint) => setActiveDialog({ kind: "rotate", endpoint }),
        onDelete: (endpoint) => setActiveDialog({ kind: "delete", endpoint })
      }),
    // The two handlers are recreated every render and deliberately left out: they close over
    // nothing the columns render, and listing them would rebuild every column on each keystroke of
    // an open dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, timeZone, isPending]
  )

  const { table } = useDataTable({
    data: endpoints,
    columns,
    getRowId: (endpoint) => endpoint.id,
    enableRowSelection: false,
    columnVisibilityStorageKey: "webhook-endpoints:column-visibility",
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  const onCreated = (endpoint: WebhookEndpointListItem, secret: string) => {
    setEndpoints((current) => [endpoint, ...current])
    setActiveDialog({ kind: "secret", secret })

    router.refresh()
  }

  const onRotate = () => {
    if (!rotateTarget || isPending) return

    startTransition(async () => {
      const result = await rotateWebhookEndpointSecret({ endpointId: rotateTarget.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setActiveDialog({ kind: "secret", secret: result.data.secret })

      toast.success(t("settings.webhooks.secretRotated"))
    })
  }

  const onDelete = () => {
    if (!deleteTarget || isPending) return

    startTransition(async () => {
      const result = await deleteWebhookEndpoint({ endpointId: deleteTarget.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setEndpoints((current) =>
        current.filter((endpoint) => endpoint.id !== result.data.endpointId)
      )
      setActiveDialog(null)

      toast.success(t("settings.webhooks.deleted"))

      router.refresh()
    })
  }

  useEffect(() => {
    setEndpoints(initialEndpoints)
  }, [initialEndpoints])

  return (
    <Fragment>
      <DataTable
        table={table}
        caption={t("settings.webhooks.endpointsTitle")}
        empty={
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="Webhook" />
              </EmptyMedia>
              <EmptyTitle>{t("settings.webhooks.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("settings.webhooks.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <Typography affects={["small", "medium"]}>
              {t("settings.webhooks.endpointsTitle")}
            </Typography>
            <Typography affects={["muted", "tiny"]}>
              {t("settings.webhooks.endpointsDescription")}
            </Typography>
          </div>
          <Button type="button" size="sm" onClick={() => setActiveDialog({ kind: "create" })}>
            <Icon name="Plus" aria-hidden="true" />
            {t("settings.webhooks.add")}
          </Button>
        </div>
      </DataTable>
      <CreateWebhookDialog
        open={activeDialog?.kind === "create"}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null)
        }}
        onCreated={onCreated}
      />
      <ConfirmDialog
        open={Boolean(rotateTarget)}
        title={t("settings.webhooks.rotateTitle")}
        description={t("settings.webhooks.rotateDescription")}
        confirmLabel={t("settings.webhooks.confirmRotate")}
        cancelLabel={t("common.actions.cancel")}
        isPending={isPending}
        onOpenChange={(open) => {
          if (!open && !isPending) setActiveDialog(null)
        }}
        onConfirm={onRotate}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("settings.webhooks.deleteTitle")}
        description={t("settings.webhooks.deleteDescription")}
        confirmLabel={t("settings.webhooks.confirmDelete")}
        cancelLabel={t("common.actions.cancel")}
        isPending={isPending}
        variant="destructive"
        onOpenChange={(open) => {
          if (!open && !isPending) setActiveDialog(null)
        }}
        onConfirm={onDelete}
      />
      <WebhookSecretDialog
        secret={revealedSecret}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null)
        }}
      />
    </Fragment>
  )
}

export { WebhookEndpointsTable }
