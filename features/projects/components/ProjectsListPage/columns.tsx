"use client"

import { Fragment, type Dispatch, type SetStateAction } from "react"

import Link from "next/link"

import { type TFunction } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import { type ColumnDef } from "@/hooks"

import {
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
  Skeleton
} from "@/components/ui"

import { PROJECT_STATUS_VALUES } from "../../schemas"
import { type ProjectListItem } from "../../types"

import { ProjectStatusBadge } from "../ProjectStatusBadge"

export function getProjectColumns(
  t: TFunction,
  locale: string,
  setDeleteIds: Dispatch<SetStateAction<string[]>>
): ColumnDef<ProjectListItem>[] {
  const stageOptions = PROJECT_STATUS_VALUES.map((value) => ({
    label: t(`projects.status.${value}`),
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
      accessorFn: (project) => project.name,
      enableHiding: false,
      meta: {
        label: t("projects.fields.name"),
        skeleton: (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        )
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("projects.fields.name")} />
      ),
      cell: ({ row }) => {
        const project = row.original

        return (
          <div className="flex min-w-0 flex-col">
            {project.deletedAt ? (
              <span className="truncate font-medium">{project.name}</span>
            ) : (
              <Link
                href={`/projects/${project.id}`}
                className="truncate font-medium hover:underline"
              >
                {project.name}
              </Link>
            )}
            <span className="text-muted-foreground truncate text-xs">{project.clientName}</span>
          </div>
        )
      }
    },
    {
      id: "client",
      accessorFn: (project) => project.clientName,
      meta: {
        label: t("projects.fields.client"),
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("projects.fields.client")} />
      ),
      cell: ({ row }) => (
        <Link
          href={`/clients/${row.original.clientId}`}
          className="truncate text-sm hover:underline"
        >
          {row.original.clientName}
        </Link>
      )
    },
    {
      id: "stage",
      accessorFn: (project) => project.status,
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: t("projects.fields.status"),
        variant: "multiSelect",
        options: stageOptions,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("projects.fields.status")} />
      ),
      cell: ({ row }) => {
        const project = row.original

        return project.deletedAt ? (
          <Badge variant="outline">{t("projects.statusFilter.deleted")}</Badge>
        ) : (
          <ProjectStatusBadge status={project.status} />
        )
      }
    },
    {
      id: "budget",
      accessorFn: (project) => project.budgetCents,
      enableSorting: false,
      meta: {
        label: t("projects.fields.budget"),
        cellClassName: "font-mono text-sm",
        skeleton: <Skeleton className="h-3.5 w-16" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("projects.fields.budget")} />
      ),
      cell: ({ row }) => {
        const project = row.original

        return project.budgetCents === null ? (
          <span className="text-muted-foreground text-sm">{t("projects.detail.emptyValue")}</span>
        ) : (
          <span>{formatCurrency(project.budgetCents, project.currency, locale)}</span>
        )
      }
    },
    {
      id: "created",
      accessorFn: (project) => project.createdAt,
      meta: {
        label: t("projects.list.created"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("projects.list.created")} />
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
        const project = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" label={t("projects.list.actions")}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!project.deletedAt ? (
                <Fragment>
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${project.id}`}>
                      <Icon name="ArrowRight" aria-hidden="true" />
                      {t("projects.list.viewProject")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteIds([project.id])}
                  >
                    <Icon name="Trash2" aria-hidden="true" />
                    {t("projects.actions.delete")}
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
