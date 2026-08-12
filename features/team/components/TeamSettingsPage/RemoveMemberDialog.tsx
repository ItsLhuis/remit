"use client"

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
  Spinner
} from "@/components/ui"

import { type TeamMemberListItem } from "../../types"

type RemoveMemberDialogProps = {
  member: TeamMemberListItem | null
  isRemoving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const RemoveMemberDialog = ({
  member,
  isRemoving,
  onOpenChange,
  onConfirm
}: RemoveMemberDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.team.removeTitle")}</DialogTitle>
          <DialogDescription>
            {member
              ? t("settings.team.removeDescription", { name: member.name })
              : t("settings.team.removeDescriptionFallback")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isRemoving}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isRemoving} onClick={onConfirm}>
            {isRemoving && <Spinner />}
            {t("settings.team.confirmRemove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { RemoveMemberDialog }
