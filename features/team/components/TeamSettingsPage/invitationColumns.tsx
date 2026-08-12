"use client"

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

import { teamRolePresentation } from "../../labels"
import { type TeamInvitationListItem } from "../../types"

type TeamInvitationColumnsOptions = {
  t: TFunction
  locale: string
  timeZone: string
  isBusy: boolean
  onShowLink: (invitation: TeamInvitationListItem) => void
  onCancel: (invitation: TeamInvitationListItem) => void
}

export function getTeamInvitationColumns({
  t,
  locale,
  timeZone,
  isBusy,
  onShowLink,
  onCancel
}: TeamInvitationColumnsOptions): ColumnDef<TeamInvitationListItem>[] {
  return [
    {
      accessorKey: "email",
      enableHiding: false,
      meta: {
        label: t("settings.team.tableInvitee"),
        skeleton: <Skeleton className="h-3.5 w-48" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.team.tableInvitee")} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.email}</span>
    },
    {
      accessorKey: "role",
      meta: {
        label: t("settings.team.tableRole"),
        skeleton: <Skeleton className="h-5 w-24 rounded-full" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.team.tableRole")} />
      ),
      cell: ({ row }) => {
        const presentation = teamRolePresentation[row.original.role]

        return (
          <Badge variant={presentation.variant}>
            <Icon name={presentation.icon} aria-hidden="true" />
            {t(`settings.team.roles.${row.original.role}`)}
          </Badge>
        )
      }
    },
    {
      accessorKey: "expiresAt",
      meta: {
        label: t("settings.team.tableExpires"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.team.tableExpires")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {formatDay(row.original.expiresAt, locale, timeZone)}
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
        const invitation = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="ghost"
                size="icon-sm"
                label={t("settings.team.tableActions")}
                disabled={isBusy}
              >
                <Icon name="EllipsisVertical" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                disabled={!invitation.shareLink}
                onSelect={() => onShowLink(invitation)}
              >
                <Icon name="Link" aria-hidden="true" />
                {t("settings.team.showLink")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onCancel(invitation)}>
                <Icon name="CircleX" aria-hidden="true" />
                {t("settings.team.cancelInvitation")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
