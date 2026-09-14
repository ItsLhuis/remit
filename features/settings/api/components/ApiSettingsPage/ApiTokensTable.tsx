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

import { revokeApiToken } from "../../mutations"
import { type ApiTokenListItem } from "../../types"

import { CreateApiTokenDialog } from "./CreateApiTokenDialog"
import { getApiTokenColumns } from "./tokenColumns"

const API_DOCUMENT_PATH = "/api/v1/openapi.json"

type ApiTokensTableProps = {
  initialTokens: ApiTokenListItem[]
  locale: string
  timeZone: string
}

const ApiTokensTable = ({ initialTokens, locale, timeZone }: ApiTokensTableProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [tokens, setTokens] = useState(initialTokens)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ApiTokenListItem | null>(null)

  const [isRevoking, startRevoking] = useTransition()

  const columns = useMemo<ColumnDef<ApiTokenListItem>[]>(
    () =>
      getApiTokenColumns({ t, locale, timeZone, isBusy: isRevoking, onRevoke: setRevokeTarget }),
    [t, locale, timeZone, isRevoking]
  )

  const { table } = useDataTable({
    data: tokens,
    columns,
    getRowId: (token) => token.id,
    enableRowSelection: false,
    columnVisibilityStorageKey: "api-tokens:column-visibility",
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  const onCreated = (token: ApiTokenListItem) => {
    setTokens((current) => [token, ...current])

    router.refresh()
  }

  const onRevoke = () => {
    if (!revokeTarget || isRevoking) return

    startRevoking(async () => {
      const result = await revokeApiToken({ tokenId: revokeTarget.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setTokens((current) =>
        current.map((token) => (token.id === result.data.token.id ? result.data.token : token))
      )
      setRevokeTarget(null)

      toast.success(t("settings.api.revoked", { name: result.data.token.name }))

      router.refresh()
    })
  }

  useEffect(() => {
    setTokens(initialTokens)
  }, [initialTokens])

  return (
    <Fragment>
      <DataTable
        table={table}
        caption={t("settings.api.tokensTitle")}
        empty={
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="KeyRound" />
              </EmptyMedia>
              <EmptyTitle>{t("settings.api.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("settings.api.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <Typography affects={["small", "medium"]}>{t("settings.api.tokensTitle")}</Typography>
            <Typography affects={["muted", "tiny"]}>
              {t("settings.api.tokensDescription", { path: API_DOCUMENT_PATH })}
            </Typography>
          </div>
          <Button type="button" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Icon name="Plus" aria-hidden="true" />
            {t("settings.api.create")}
          </Button>
        </div>
      </DataTable>
      <CreateApiTokenDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={onCreated}
      />
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={t("settings.api.revokeTitle", { name: revokeTarget?.name ?? "" })}
        description={t("settings.api.revokeDescription")}
        confirmLabel={t("settings.api.confirmRevoke")}
        cancelLabel={t("common.actions.cancel")}
        isPending={isRevoking}
        variant="destructive"
        onOpenChange={(open) => {
          if (!open && !isRevoking) setRevokeTarget(null)
        }}
        onConfirm={onRevoke}
      />
    </Fragment>
  )
}

export { ApiTokensTable }
