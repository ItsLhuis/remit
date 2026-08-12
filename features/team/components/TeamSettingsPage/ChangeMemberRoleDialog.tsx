"use client"

import { useState, useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  toast
} from "@/components/ui"

import { changeTeamMemberRole } from "../../mutations"
import { ASSIGNABLE_ROLES, type AssignableRole } from "../../schemas"
import { toAssignableRole } from "../../services/teamMembership"
import { type TeamMemberListItem } from "../../types"

function getInitialRole(member: TeamMemberListItem | null): AssignableRole {
  return member && member.role !== "owner" ? member.role : "accountant"
}

type ChangeMemberRoleDialogProps = {
  member: TeamMemberListItem | null
  onOpenChange: (open: boolean) => void
  onChanged: (member: TeamMemberListItem) => void
}

const ChangeMemberRoleDialog = ({
  member,
  onOpenChange,
  onChanged
}: ChangeMemberRoleDialogProps) => {
  const { t } = useTranslation()

  // Null means "nothing picked yet", which is what lets the select fall back to whichever member
  // the dialog is currently showing without an effect resyncing it on every open.
  const [pickedRole, setPickedRole] = useState<AssignableRole | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const [isSaving, startSaving] = useTransition()

  const role = pickedRole ?? getInitialRole(member)

  const submitDisabled = isSaving || !member || role === member.role

  const onConfirm = () => {
    if (!member || submitDisabled) return

    setServerError(null)

    startSaving(async () => {
      const result = await changeTeamMemberRole({ memberId: member.id, role })

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      onChanged(result.data.member)

      toast.success(t("settings.team.roleChanged", { name: member.name }))
    })
  }

  return (
    <Dialog
      open={Boolean(member)}
      onOpenChange={(open) => {
        if (isSaving) return

        if (!open) {
          setPickedRole(null)
          setServerError(null)
        }

        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.team.changeRoleTitle")}</DialogTitle>
          <DialogDescription>
            {member
              ? t("settings.team.changeRoleDescription", { name: member.name })
              : t("settings.team.changeRoleDescriptionFallback")}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="team-member-role">{t("settings.team.tableRole")}</FieldLabel>
          <Select
            value={role}
            onValueChange={(value) => {
              const nextRole = toAssignableRole(value)

              if (nextRole) setPickedRole(nextRole)
            }}
            disabled={isSaving}
          >
            <SelectTrigger id="team-member-role" className="w-full">
              <SelectValue placeholder={t("settings.team.selectRole")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {ASSIGNABLE_ROLES.map((assignableRole) => (
                  <SelectItem key={assignableRole} value={assignableRole}>
                    {t(`settings.team.roles.${assignableRole}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>{t(`settings.team.roleDescriptions.${role}`)}</FieldDescription>
        </Field>
        {serverError && <FieldError>{serverError}</FieldError>}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" disabled={submitDisabled} onClick={onConfirm}>
            {isSaving && <Spinner />}
            {t("settings.team.confirmRoleChange")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ChangeMemberRoleDialog }
