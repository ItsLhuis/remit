"use client"

import { Fragment, type Dispatch, type SetStateAction } from "react"

import Link from "next/link"

import { type TFunction } from "@/lib/i18n"

import { formatDay, getInitials } from "@/lib/utils"

import { type ColumnDef } from "@/hooks"

import {
  Avatar,
  AvatarFallback,
  Badge,
  Checkbox,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Skeleton,
  toast
} from "@/components/ui"

import { LEAD_STATUS_VALUES } from "../../schemas"
import { type LeadListItem } from "../../types"

import { LeadStatusBadge } from "../LeadStatusBadge"

export function getLeadColumns(
  t: TFunction,
  locale: string,
  setDeleteIds: Dispatch<SetStateAction<string[]>>
): ColumnDef<LeadListItem>[] {
  const stageOptions = LEAD_STATUS_VALUES.map((value) => ({
    label: t(`leads.status.${value}`),
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
      id: "name",
      accessorFn: (lead) => lead.displayName,
      enableHiding: false,
      meta: {
        label: t("leads.fields.name"),
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
        <DataTableColumnHeader column={column} title={t("leads.fields.name")} />
      ),
      cell: ({ row }) => {
        const lead = row.original

        return (
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              <AvatarFallback>{getInitials(lead.displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              {lead.deletedAt ? (
                <span className="truncate font-medium">{lead.displayName}</span>
              ) : (
                <Link href={`/leads/${lead.id}`} className="truncate font-medium hover:underline">
                  {lead.displayName}
                </Link>
              )}
              <span className="text-muted-foreground truncate text-xs">{lead.email}</span>
            </div>
          </div>
        )
      }
    },
    {
      accessorKey: "company",
      meta: {
        label: t("leads.fields.company"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("leads.fields.company")} />
      ),
      cell: ({ row }) => {
        const company = row.original.company

        return company ? (
          <span className="truncate text-sm">{company}</span>
        ) : (
          <span className="text-muted-foreground text-sm">{t("leads.detail.emptyValue")}</span>
        )
      }
    },
    {
      id: "stage",
      accessorFn: (lead) => lead.status,
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("leads.fields.status"),
        variant: "multiSelect",
        options: stageOptions,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("leads.fields.status")} />
      ),
      cell: ({ row }) => {
        const lead = row.original

        return lead.deletedAt ? (
          <Badge variant="outline">{t("leads.statusFilter.deleted")}</Badge>
        ) : (
          <LeadStatusBadge status={lead.status} />
        )
      }
    },
    {
      accessorKey: "source",
      enableSorting: false,
      meta: {
        label: t("leads.fields.source"),
        skeleton: <Skeleton className="h-3.5 w-16" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("leads.fields.source")} />
      ),
      cell: ({ row }) => {
        const source = row.original.source

        return source ? (
          <span className="text-muted-foreground text-sm">{source}</span>
        ) : (
          <span className="text-muted-foreground text-sm">{t("leads.detail.emptyValue")}</span>
        )
      }
    },
    {
      id: "created",
      accessorFn: (lead) => lead.createdAt,
      meta: {
        label: t("leads.list.created"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("leads.list.created")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDay(row.original.createdAt, locale)}
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
        const lead = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" label={t("leads.list.actions")}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!lead.deletedAt ? (
                <DropdownMenuItem asChild>
                  <Link href={`/leads/${lead.id}`}>
                    <Icon name="ArrowRight" aria-hidden="true" />
                    {t("leads.list.viewLead")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onSelect={() => {
                  void navigator.clipboard
                    .writeText(lead.email)
                    .then(() => toast.success(t("leads.list.emailCopied")))
                }}
              >
                <Icon name="Copy" aria-hidden="true" />
                {t("leads.list.copyEmail")}
              </DropdownMenuItem>
              {!lead.deletedAt ? (
                <Fragment>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteIds([lead.id])}>
                    <Icon name="Trash2" aria-hidden="true" />
                    {t("leads.actions.delete")}
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
