"use client"

import { Fragment, useEffect, useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Typography,
  toast
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { cancelTeamInvitation, removeTeamMember } from "../../mutations"
import { sortTeamMembers } from "../../services/teamMembership"
import { type TeamInvitationListItem, type TeamMemberListItem } from "../../types"

import { CancelInvitationDialog } from "./CancelInvitationDialog"
import { ChangeMemberRoleDialog } from "./ChangeMemberRoleDialog"
import { getTeamInvitationColumns } from "./invitationColumns"
import { InvitationLinkDialog } from "./InvitationLinkDialog"
import { InviteMemberDialog } from "./InviteMemberDialog"
import { getTeamMemberColumns } from "./memberColumns"
import { RemoveMemberDialog } from "./RemoveMemberDialog"

type ActiveDialog =
  | { kind: "invite" }
  | { kind: "role"; member: TeamMemberListItem }
  | { kind: "remove"; member: TeamMemberListItem }
  | { kind: "cancel"; invitation: TeamInvitationListItem }
  | { kind: "link"; invitation: TeamInvitationListItem }
  | null

type TeamSettingsFormProps = {
  initialMembers: TeamMemberListItem[]
  initialInvitations: TeamInvitationListItem[]
  emailConfigured: boolean
  locale: string
  timeZone: string
}

const TeamSettingsForm = ({
  initialMembers,
  initialInvitations,
  emailConfigured,
  locale,
  timeZone
}: TeamSettingsFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [members, setMembers] = useState(initialMembers)
  const [invitations, setInvitations] = useState(initialInvitations)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)

  const [isRemovePending, startRemoveTransition] = useTransition()
  const [isCancelPending, startCancelTransition] = useTransition()

  useEffect(() => {
    setMembers(initialMembers)
  }, [initialMembers])

  useEffect(() => {
    setInvitations(initialInvitations)
  }, [initialInvitations])

  const roleTarget = activeDialog?.kind === "role" ? activeDialog.member : null
  const removeTarget = activeDialog?.kind === "remove" ? activeDialog.member : null
  const cancelTarget = activeDialog?.kind === "cancel" ? activeDialog.invitation : null
  const linkTarget = activeDialog?.kind === "link" ? activeDialog.invitation : null

  const isBusy = isRemovePending || isCancelPending

  const memberColumns = useMemo<ColumnDef<TeamMemberListItem>[]>(
    () =>
      getTeamMemberColumns({
        t,
        locale,
        timeZone,
        isBusy,
        onChangeRole: (member) => setActiveDialog({ kind: "role", member }),
        onRemove: (member) => setActiveDialog({ kind: "remove", member })
      }),
    [t, locale, timeZone, isBusy]
  )

  const invitationColumns = useMemo<ColumnDef<TeamInvitationListItem>[]>(
    () =>
      getTeamInvitationColumns({
        t,
        locale,
        timeZone,
        isBusy,
        onShowLink: (invitation) => setActiveDialog({ kind: "link", invitation }),
        onCancel: (invitation) => setActiveDialog({ kind: "cancel", invitation })
      }),
    [t, locale, timeZone, isBusy]
  )

  const { table: memberTable } = useDataTable({
    data: members,
    columns: memberColumns,
    getRowId: (member) => member.id,
    enableRowSelection: false,
    columnVisibilityStorageKey: "team-members:column-visibility",
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  const { table: invitationTable } = useDataTable({
    data: invitations,
    columns: invitationColumns,
    getRowId: (invitation) => invitation.id,
    enableRowSelection: false,
    columnVisibilityStorageKey: "team-invitations:column-visibility",
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  const onInvited = (invitation: TeamInvitationListItem) => {
    setInvitations((current) => [
      invitation,
      ...current.filter((existing) => existing.email !== invitation.email)
    ])

    // The link dialog replaces the invite dialog only when there is a link to show, which is
    // exactly the unconfigured-email case: nothing else tells the owner the invitation still needs
    // delivering by hand.
    setActiveDialog(invitation.shareLink ? { kind: "link", invitation } : null)

    router.refresh()
  }

  const onRoleChanged = (member: TeamMemberListItem) => {
    setMembers((current) =>
      sortTeamMembers(current.map((existing) => (existing.id === member.id ? member : existing)))
    )
    setActiveDialog(null)

    router.refresh()
  }

  const onRemove = () => {
    if (!removeTarget || isRemovePending) return

    startRemoveTransition(async () => {
      const result = await removeTeamMember({ memberId: removeTarget.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setMembers((current) => current.filter((member) => member.id !== result.data.memberId))
      setActiveDialog(null)

      toast.success(
        result.data.sessionsRevoked
          ? t("settings.team.removed", { name: removeTarget.name })
          : t("settings.team.removedSessionsKept", { name: removeTarget.name })
      )

      router.refresh()
    })
  }

  const onCancelInvitation = () => {
    if (!cancelTarget || isCancelPending) return

    startCancelTransition(async () => {
      const result = await cancelTeamInvitation({ invitationId: cancelTarget.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setInvitations((current) =>
        current.filter((invitation) => invitation.id !== result.data.invitationId)
      )
      setActiveDialog(null)

      toast.success(t("settings.team.invitationCanceled", { email: cancelTarget.email }))

      router.refresh()
    })
  }

  return (
    <Fragment>
      <DataTable table={memberTable} caption={t("settings.team.membersTitle")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <Typography affects={["small", "medium"]}>{t("settings.team.membersTitle")}</Typography>
            <Typography affects={["muted", "tiny"]}>
              {t("settings.team.membersCount", { count: members.length })}
            </Typography>
          </div>
          <Button type="button" size="sm" onClick={() => setActiveDialog({ kind: "invite" })}>
            <Icon name="UserPlus" aria-hidden="true" />
            {t("settings.team.invite")}
          </Button>
        </div>
      </DataTable>
      <DataTable
        table={invitationTable}
        caption={t("settings.team.invitationsTitle")}
        empty={
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="MailPlus" />
              </EmptyMedia>
              <EmptyTitle>{t("settings.team.invitationsEmptyTitle")}</EmptyTitle>
              <EmptyDescription>
                {emailConfigured
                  ? t("settings.team.invitationsEmptyDescription")
                  : t("settings.team.invitationsEmptyDescriptionNoEmail")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      >
        <div className="flex flex-col gap-0.5">
          <Typography affects={["small", "medium"]}>
            {t("settings.team.invitationsTitle")}
          </Typography>
          <Typography affects={["muted", "tiny"]}>
            {t("settings.team.invitationsDescription")}
          </Typography>
        </div>
      </DataTable>
      <InviteMemberDialog
        open={activeDialog?.kind === "invite"}
        emailConfigured={emailConfigured}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null)
        }}
        onInvited={onInvited}
      />
      <ChangeMemberRoleDialog
        member={roleTarget}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null)
        }}
        onChanged={onRoleChanged}
      />
      <RemoveMemberDialog
        member={removeTarget}
        isRemoving={isRemovePending}
        onOpenChange={(open) => {
          if (!open && !isRemovePending) setActiveDialog(null)
        }}
        onConfirm={onRemove}
      />
      <CancelInvitationDialog
        invitation={cancelTarget}
        isCanceling={isCancelPending}
        onOpenChange={(open) => {
          if (!open && !isCancelPending) setActiveDialog(null)
        }}
        onConfirm={onCancelInvitation}
      />
      <InvitationLinkDialog
        invitation={linkTarget}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null)
        }}
      />
    </Fragment>
  )
}

export { TeamSettingsForm }
