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
  Skeleton,
  Typography
} from "@/components/ui"

import { type ColumnDef } from "@/hooks"

import { teamRolePresentation } from "../../labels"
import { type TeamMemberListItem } from "../../types"

type TeamMemberColumnsOptions = {
  t: TFunction
  locale: string
  timeZone: string
  isBusy: boolean
  onChangeRole: (member: TeamMemberListItem) => void
  onRemove: (member: TeamMemberListItem) => void
}

export function getTeamMemberColumns({
  t,
  locale,
  timeZone,
  isBusy,
  onChangeRole,
  onRemove
}: TeamMemberColumnsOptions): ColumnDef<TeamMemberListItem>[] {
  return [
    {
      accessorKey: "name",
      enableHiding: false,
      meta: {
        label: t("settings.team.tableMember"),
        skeleton: <Skeleton className="h-3.5 w-40" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.team.tableMember")} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{row.original.name}</span>
          <Typography affects={["muted", "tiny"]}>{row.original.email}</Typography>
        </div>
      )
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
      accessorKey: "joinedAt",
      meta: {
        label: t("settings.team.tableJoined"),
        skeleton: <Skeleton className="h-3.5 w-24" />
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("settings.team.tableJoined")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {formatDay(row.original.joinedAt, locale, timeZone)}
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
        const member = row.original

        // The owner row has no menu at all rather than a disabled one: every action it could offer
        // is refused by `decideRoleChange`/`decideRemoval`, and a menu that only ever explains
        // itself with an error reads as a bug.
        if (member.role === "owner") return null

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
              <DropdownMenuItem onSelect={() => onChangeRole(member)}>
                <Icon name="UserCog" aria-hidden="true" />
                {t("settings.team.changeRole")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onRemove(member)}>
                <Icon name="UserMinus" aria-hidden="true" />
                {t("settings.team.removeMember")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]
}
