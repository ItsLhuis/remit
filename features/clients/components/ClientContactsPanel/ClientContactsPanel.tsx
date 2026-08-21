"use client"

import { Fragment, useCallback, useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
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

import { setPrimaryClientContact, softDeleteClientContact } from "../../mutations"
import { type ClientContact } from "../../types"

import { ClientContactDialog } from "./ClientContactDialog"
import { getClientContactColumns } from "./columns"
import { DeleteClientContactDialog } from "./DeleteClientContactDialog"

type ClientContactsPanelProps = {
  clientId: string
  clientEmail: string
  contacts: ClientContact[]
}

const ClientContactsPanel = ({ clientId, clientEmail, contacts }: ClientContactsPanelProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ClientContact | null>(null)
  const [deleting, setDeleting] = useState<ClientContact | null>(null)
  const [isPending, startPending] = useTransition()

  const onSuccess = (message: string) => {
    toast.success(message)

    router.refresh()
  }

  // Stable across renders on purpose: it is handed to `getClientContactColumns`, and a new identity
  // on every render would rebuild the column array and remount an open row menu mid-click.
  const onMakePrimary = useCallback(
    (contact: ClientContact) => {
      startPending(async () => {
        const result = await setPrimaryClientContact({ id: contact.id })

        if ("error" in result) {
          toast.error(result.error)

          return
        }

        toast.success(t("clients.contacts.promoted"))

        router.refresh()
      })
    },
    [router, t]
  )

  const onDelete = () => {
    if (!deleting || isPending) return

    startPending(async () => {
      const result = await softDeleteClientContact({ id: deleting.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setDeleting(null)

      onSuccess(t("clients.contacts.deleted"))
    })
  }

  const columns = useMemo<ColumnDef<ClientContact>[]>(
    () => getClientContactColumns(t, { onEdit: setEditing, onMakePrimary, onDelete: setDeleting }),
    [onMakePrimary, t]
  )

  const primary = contacts.find((contact) => contact.isPrimary)

  const { table } = useDataTable({
    data: contacts,
    columns,
    getRowId: (contact) => contact.id,
    enableRowSelection: false,
    // The client workspace already renders a table in its Projects tab, and both read the same
    // query parameters; without a prefix, paginating one paginates the other on the next tab switch.
    urlKeyPrefix: "contact_",
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  return (
    <Fragment>
      <DataTable
        table={table}
        caption={t("clients.contacts.title")}
        empty={
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="Users" />
              </EmptyMedia>
              <EmptyTitle>{t("clients.contacts.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("clients.contacts.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <Typography affects={["small", "medium"]}>{t("clients.contacts.title")}</Typography>
            <Typography affects={["muted", "small"]}>
              {primary
                ? t("clients.contacts.recipientNote", { email: primary.email })
                : t("clients.contacts.noPrimaryNote", { email: clientEmail })}
            </Typography>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Icon name="Plus" aria-hidden="true" />
            {t("clients.contacts.add")}
          </Button>
        </div>
      </DataTable>
      <ClientContactDialog
        mode="create"
        clientId={clientId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={onSuccess}
      />
      {editing ? (
        <ClientContactDialog
          key={editing.id}
          mode="edit"
          contact={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          onSuccess={onSuccess}
        />
      ) : null}
      <DeleteClientContactDialog
        contactName={deleting?.name ?? ""}
        open={deleting !== null}
        isDeleting={isPending}
        onOpenChange={(open) => {
          if (!open && !isPending) setDeleting(null)
        }}
        onConfirm={onDelete}
      />
    </Fragment>
  )
}

export { ClientContactsPanel }
