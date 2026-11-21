"use client"

import { type TFunction } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import { DataTableColumnHeader, Skeleton } from "@/components/ui"

import { type ColumnDef } from "@/hooks"

import { PROPOSAL_STATUS_VALUES, type ProposalStatus } from "../schemas"

import { ProposalStatusBadge } from "./ProposalStatusBadge"

// The columns both proposal tables render identically. They are shared rather than duplicated so a
// change to how a status, a validity date, or a total reads applies to the project-scoped list and
// the instance-wide overview at once. Each factory is generic over the row model and constrains only
// the fields it renders, so neither table has to adopt the other's read model.

export function getProposalStatusColumn<TRow extends { status: ProposalStatus }>(
  t: TFunction
): ColumnDef<TRow> {
  const statusOptions = PROPOSAL_STATUS_VALUES.map((value) => ({
    label: t(`proposals.status.${value}`),
    value
  }))

  return {
    id: "status",
    accessorFn: (proposal) => proposal.status,
    enableSorting: false,
    enableColumnFilter: true,
    meta: {
      label: t("proposals.table.statusColumn"),
      variant: "multiSelect",
      options: statusOptions,
      skeleton: <Skeleton className="h-5 w-20 rounded-full" />
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("proposals.table.statusColumn")} />
    ),
    cell: ({ row }) => <ProposalStatusBadge status={row.original.status} />
  }
}

export function getProposalValidUntilColumn<TRow extends { validUntil: Date | null }>(
  t: TFunction,
  locale: string
): ColumnDef<TRow> {
  return {
    id: "validUntil",
    accessorFn: (proposal) => proposal.validUntil,
    enableColumnFilter: true,
    meta: {
      label: t("proposals.table.validUntilColumn"),
      variant: "date",
      skeleton: <Skeleton className="h-3.5 w-24" />
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("proposals.table.validUntilColumn")} />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {row.original.validUntil
          ? formatDay(row.original.validUntil, locale)
          : t("proposals.table.noValidUntil")}
      </span>
    )
  }
}

export function getProposalTotalColumn<TRow extends { totalCents: number; currency: string }>(
  t: TFunction,
  locale: string
): ColumnDef<TRow> {
  return {
    id: "total",
    accessorFn: (proposal) => proposal.totalCents,
    enableColumnFilter: true,
    meta: {
      align: "end",
      label: t("proposals.table.totalColumn"),
      variant: "range",
      skeleton: <Skeleton className="ml-auto h-3.5 w-24" />
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("proposals.table.totalColumn")} />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium tabular-nums">
        {formatCurrency(row.original.totalCents, row.original.currency, locale)}
      </span>
    )
  }
}

export function getProposalCreatedColumn<TRow extends { createdAt: Date }>(
  t: TFunction,
  locale: string
): ColumnDef<TRow> {
  return {
    id: "created",
    accessorFn: (proposal) => proposal.createdAt,
    enableColumnFilter: true,
    meta: {
      label: t("proposals.table.createdColumn"),
      variant: "date",
      skeleton: <Skeleton className="h-3.5 w-24" />
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("proposals.table.createdColumn")} />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatDay(row.original.createdAt, locale)}
      </span>
    )
  }
}
