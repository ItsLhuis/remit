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

import { type TeamInvitationListItem } from "../../types"

type CancelInvitationDialogProps = {
  invitation: TeamInvitationListItem | null
  isCanceling: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const CancelInvitationDialog = ({
  invitation,
  isCanceling,
  onOpenChange,
  onConfirm
}: CancelInvitationDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={Boolean(invitation)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.team.cancelInvitationTitle")}</DialogTitle>
          <DialogDescription>
            {invitation
              ? t("settings.team.cancelInvitationDescription", { email: invitation.email })
              : t("settings.team.cancelInvitationDescriptionFallback")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isCanceling}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isCanceling} onClick={onConfirm}>
            {isCanceling && <Spinner />}
            {t("settings.team.confirmCancelInvitation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { CancelInvitationDialog }
