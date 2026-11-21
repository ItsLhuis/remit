"use client"

import { Fragment } from "react"

import Link from "next/link"

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

import { TEMPLATE_TYPE_LABEL_KEYS } from "../../labels"
import { TEMPLATE_TYPES } from "../../schemas"
import { type TemplateListItem } from "../../types"
import { TemplateTypeBadge } from "../TemplateTypeBadge"

export function getTemplateColumns(
  t: TFunction,
  locale: string,
  onPreview: (template: TemplateListItem) => void,
  onDelete: (template: TemplateListItem) => void
): ColumnDef<TemplateListItem>[] {
  const typeOptions = TEMPLATE_TYPES.map((type) => ({
    label: t(TEMPLATE_TYPE_LABEL_KEYS[type]),
    value: type
  }))

  return [
    {
      id: "name",
      accessorFn: (template) => template.name,
      enableHiding: false,
      meta: {
        label: t("templates.fields.name"),
        skeleton: (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        )
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("templates.fields.name")} />
      ),
      cell: ({ row }) => {
        const template = row.original

        return (
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={`/templates/${template.id}`}
                className="truncate font-medium hover:underline"
              >
                {template.name}
              </Link>
              {template.isDefault ? (
                <Badge className="shrink-0">
                  <Icon name="Star" aria-hidden="true" />
                  {t("templates.badges.default")}
                </Badge>
              ) : null}
              {template.isSystem ? (
                <Badge variant="outline" className="shrink-0">
                  <Icon name="Lock" aria-hidden="true" />
                  {t("templates.badges.system")}
                </Badge>
              ) : null}
            </div>
            {template.subject ? (
              <span className="text-muted-foreground truncate text-xs">{template.subject}</span>
            ) : null}
          </div>
        )
      }
    },
    {
      id: "type",
      accessorFn: (template) => template.type,
      enableColumnFilter: true,
      meta: {
        label: t("templates.fields.type"),
        variant: "multiSelect",
        options: typeOptions,
        skeleton: <Skeleton className="h-5 w-24 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("templates.fields.type")} />
      ),
      cell: ({ row }) => <TemplateTypeBadge type={row.original.type} />
    },
    {
      id: "updated",
      accessorFn: (template) => template.updatedAt,
      meta: {
        label: t("templates.list.updatedColumn"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("templates.list.updatedColumn")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDay(row.original.updatedAt, locale)}
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
        const template = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" label={t("templates.list.actions")}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/templates/${template.id}`}>
                  <Icon name="Pencil" aria-hidden="true" />
                  {t("templates.actions.edit")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPreview(template)}>
                <Icon name="Eye" aria-hidden="true" />
                {t("templates.actions.preview")}
              </DropdownMenuItem>
              {template.isSystem ? null : (
                <Fragment>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(template)}>
                    <Icon name="Trash2" aria-hidden="true" />
                    {t("templates.actions.delete")}
                  </DropdownMenuItem>
                </Fragment>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
