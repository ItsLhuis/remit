"use client"

import Link from "next/link"

import { type TFunction } from "@/lib/i18n"

import {
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

import { isProposalEditable } from "../../services"
import { type ProposalListItem } from "../../types"
import {
  getProposalCreatedColumn,
  getProposalStatusColumn,
  getProposalTotalColumn,
  getProposalValidUntilColumn
} from "../proposalColumns"

type ProposalColumnsOptions = {
  t: TFunction
  locale: string
  projectId: string
  onDelete: (id: string) => void
}

export function getProposalColumns({
  t,
  locale,
  projectId,
  onDelete
}: ProposalColumnsOptions): ColumnDef<ProposalListItem>[] {
  return [
    {
      accessorKey: "number",
      enableHiding: false,
      meta: {
        label: t("proposals.table.numberColumn"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("proposals.table.numberColumn")} />
      ),
      cell: ({ row }) => (
        <Link
          href={`/projects/${projectId}/proposals/${row.original.id}`}
          className="font-mono text-sm font-medium hover:underline"
        >
          {row.original.number}
        </Link>
      )
    },
    getProposalStatusColumn<ProposalListItem>(t),
    getProposalValidUntilColumn<ProposalListItem>(t, locale),
    getProposalCreatedColumn<ProposalListItem>(t, locale),
    getProposalTotalColumn<ProposalListItem>(t, locale),
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
        const proposal = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" label={t("proposals.actions.rowActions")}>
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/projects/${projectId}/proposals/${proposal.id}`}>
                  <Icon name="ArrowRight" aria-hidden="true" />
                  {t("proposals.actions.view")}
                </Link>
              </DropdownMenuItem>
              {isProposalEditable(proposal.status) ? (
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${projectId}/proposals/${proposal.id}/edit`}>
                    <Icon name="Pencil" aria-hidden="true" />
                    {t("proposals.actions.edit")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(proposal.id)}>
                <Icon name="Trash2" aria-hidden="true" />
                {t("proposals.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
