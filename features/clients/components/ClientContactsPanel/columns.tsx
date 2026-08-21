"use client"

import { type TFunction } from "@/lib/i18n"

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

import { type ClientContact } from "../../types"

type ClientContactActions = {
  onEdit: (contact: ClientContact) => void
  onMakePrimary: (contact: ClientContact) => void
  onDelete: (contact: ClientContact) => void
}

export function getClientContactColumns(
  t: TFunction,
  actions: ClientContactActions
): ColumnDef<ClientContact>[] {
  return [
    {
      id: "name",
      accessorFn: (contact) => contact.name,
      enableHiding: false,
      meta: {
        label: t("clients.fields.name"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("clients.fields.name")} />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{row.original.name}</span>
          {row.original.isPrimary ? (
            <Badge variant="secondary">
              <Icon name="Star" aria-hidden="true" />
              {t("clients.contacts.primaryBadge")}
            </Badge>
          ) : null}
        </div>
      )
    },
    {
      id: "role",
      accessorFn: (contact) => contact.role,
      meta: {
        label: t("clients.contacts.role"),
        skeleton: <Skeleton className="h-3.5 w-20" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("clients.contacts.role")} />
      ),
      cell: ({ row }) =>
        row.original.role ? (
          <span className="truncate text-sm">{row.original.role}</span>
        ) : (
          <span className="text-muted-foreground text-sm">{t("clients.detail.emptyValue")}</span>
        )
    },
    {
      id: "email",
      accessorFn: (contact) => contact.email,
      meta: {
        label: t("clients.fields.email"),
        skeleton: <Skeleton className="h-3.5 w-40" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("clients.fields.email")} />
      ),
      cell: ({ row }) => (
        <a href={`mailto:${row.original.email}`} className="truncate text-sm hover:underline">
          {row.original.email}
        </a>
      )
    },
    {
      id: "phone",
      accessorFn: (contact) => contact.phone,
      enableSorting: false,
      meta: {
        label: t("clients.fields.phone"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("clients.fields.phone")} />
      ),
      cell: ({ row }) =>
        row.original.phone ? (
          <a href={`tel:${row.original.phone}`} className="truncate text-sm hover:underline">
            {row.original.phone}
          </a>
        ) : (
          <span className="text-muted-foreground text-sm">{t("clients.detail.emptyValue")}</span>
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
        const contact = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="ghost"
                size="icon-sm"
                label={t("clients.contacts.actionsLabel", { name: contact.name })}
              >
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => actions.onEdit(contact)}>
                <Icon name="Pencil" aria-hidden="true" />
                {t("clients.actions.edit")}
              </DropdownMenuItem>
              {contact.isPrimary ? null : (
                <DropdownMenuItem onSelect={() => actions.onMakePrimary(contact)}>
                  <Icon name="Star" aria-hidden="true" />
                  {t("clients.contacts.makePrimary")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(contact)}>
                <Icon name="Trash2" aria-hidden="true" />
                {t("clients.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
