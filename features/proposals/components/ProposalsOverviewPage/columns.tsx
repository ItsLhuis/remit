"use client"

import { Fragment } from "react"

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
import { type ProposalOverviewClientOption, type ProposalOverviewItem } from "../../types"
import {
  getProposalCreatedColumn,
  getProposalStatusColumn,
  getProposalTotalColumn,
  getProposalValidUntilColumn
} from "../proposalColumns"

type ProposalOverviewColumnsOptions = {
  t: TFunction
  locale: string
  clients: ProposalOverviewClientOption[]
}

export function getProposalOverviewColumns({
  t,
  locale,
  clients
}: ProposalOverviewColumnsOptions): ColumnDef<ProposalOverviewItem>[] {
  const clientOptions = clients.map((client) => ({ label: client.name, value: client.id }))

  return [
    {
      id: "number",
      accessorFn: (proposal) => proposal.number,
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
          href={`/proposals/${row.original.id}`}
          className="font-mono text-sm font-medium hover:underline"
        >
          {row.original.number}
        </Link>
      )
    },
    {
      id: "project",
      accessorFn: (proposal) => proposal.projectName,
      meta: {
        label: t("proposals.overview.projectColumn"),
        skeleton: <Skeleton className="h-3.5 w-32" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("proposals.overview.projectColumn")} />
      ),
      cell: ({ row }) => {
        const proposal = row.original

        if (!proposal.projectId) {
          return (
            <span className="text-muted-foreground text-sm">
              {t("proposals.overview.noProject")}
            </span>
          )
        }

        return (
          <Link
            href={`/projects/${proposal.projectId}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {proposal.projectName}
          </Link>
        )
      }
    },
    {
      id: "client",
      accessorFn: (proposal) => proposal.clientId,
      enableColumnFilter: true,
      meta: {
        label: t("proposals.overview.clientColumn"),
        variant: "multiSelect",
        options: clientOptions,
        skeleton: <Skeleton className="h-3.5 w-28" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("proposals.overview.clientColumn")} />
      ),
      cell: ({ row }) => {
        const proposal = row.original

        if (!proposal.clientId) {
          return (
            <span className="text-muted-foreground text-sm">
              {t("proposals.overview.noClient")}
            </span>
          )
        }

        return (
          <Link
            href={`/clients/${proposal.clientId}`}
            className="text-muted-foreground truncate text-sm hover:underline"
          >
            {proposal.clientName}
          </Link>
        )
      }
    },
    getProposalStatusColumn<ProposalOverviewItem>(t),
    getProposalValidUntilColumn<ProposalOverviewItem>(t, locale),
    getProposalTotalColumn<ProposalOverviewItem>(t, locale),
    getProposalCreatedColumn<ProposalOverviewItem>(t, locale),
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
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href={`/proposals/${proposal.id}`}>
                  <Icon name="ArrowRight" aria-hidden="true" />
                  {t("proposals.actions.view")}
                </Link>
              </DropdownMenuItem>
              {isProposalEditable(proposal.status) ? (
                <DropdownMenuItem asChild>
                  <Link href={`/proposals/${proposal.id}/edit`}>
                    <Icon name="Pencil" aria-hidden="true" />
                    {t("proposals.actions.edit")}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {proposal.projectId ? (
                <Fragment>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${proposal.projectId}`}>
                      <Icon name="FolderOpen" aria-hidden="true" />
                      {t("proposals.overview.openProject")}
                    </Link>
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
