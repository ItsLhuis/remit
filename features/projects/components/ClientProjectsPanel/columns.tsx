"use client"

import Link from "next/link"

import { type TFunction } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import { type ColumnDef } from "@/hooks"

import { Badge, DataTableColumnHeader, Skeleton } from "@/components/ui"

import { PROJECT_STATUS_VALUES } from "../../schemas"
import { type ProjectListItem } from "../../types"

import { ProjectStatusBadge } from "../ProjectStatusBadge"

export function getClientProjectColumns(
  t: TFunction,
  locale: string
): ColumnDef<ProjectListItem>[] {
  const stageOptions = PROJECT_STATUS_VALUES.map((value) => ({
    label: t(`projects.status.${value}`),
    value
  }))

  return [
    {
      id: "name",
      accessorFn: (project) => project.name,
      enableHiding: false,
      meta: {
        label: t("projects.fields.name"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("projects.fields.name")} />
      ),
      cell: ({ row }) => (
        <Link
          href={`/projects/${row.original.id}`}
          className="truncate font-medium hover:underline"
        >
          {row.original.name}
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
      cell: ({ row }) =>
        row.original.deletedAt ? (
          <Badge variant="outline">{t("projects.statusFilter.deleted")}</Badge>
        ) : (
          <ProjectStatusBadge status={row.original.status} />
        )
    },
    {
      id: "budget",
      accessorFn: (project) => project.budgetCents,
      enableSorting: false,
      meta: {
        label: t("projects.fields.budget"),
        align: "end",
        cellClassName: "font-mono text-sm",
        skeleton: <Skeleton className="ml-auto h-3.5 w-16" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("projects.fields.budget")} />
      ),
      cell: ({ row }) =>
        row.original.budgetCents === null ? (
          <span className="text-muted-foreground text-sm">{t("projects.detail.emptyValue")}</span>
        ) : (
          <span>{formatCurrency(row.original.budgetCents, row.original.currency, locale)}</span>
        )
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
    }
  ]
}
