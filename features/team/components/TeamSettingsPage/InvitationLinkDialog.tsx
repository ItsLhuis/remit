"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  IconButton,
  Input,
  toast
} from "@/components/ui"

import { type TeamInvitationListItem } from "../../types"

type InvitationLinkDialogProps = {
  invitation: TeamInvitationListItem | null
  onOpenChange: (open: boolean) => void
}

const InvitationLinkDialog = ({ invitation, onOpenChange }: InvitationLinkDialogProps) => {
  const { t } = useTranslation()

  const shareLink = invitation?.shareLink ?? null

  const onCopy = () => {
    if (!shareLink) return

    void navigator.clipboard
      .writeText(shareLink)
      .then(() => toast.success(t("settings.team.linkCopied")))
  }

  return (
    <Dialog open={Boolean(shareLink)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.team.linkTitle")}</DialogTitle>
          <DialogDescription>
            {invitation
              ? t("settings.team.linkDescription", { email: invitation.email })
              : t("settings.team.linkDescriptionFallback")}
          </DialogDescription>
        </DialogHeader>
        <Alert>
          <Icon name="TriangleAlert" aria-hidden="true" />
          <AlertTitle>{t("settings.team.linkWarningTitle")}</AlertTitle>
          <AlertDescription>{t("settings.team.linkWarningDescription")}</AlertDescription>
        </Alert>
        <div className="flex items-center gap-2">
          <Input readOnly value={shareLink ?? ""} aria-label={t("settings.team.linkTitle")} />
          <IconButton variant="outline" label={t("settings.team.copyLink")} onClick={onCopy}>
            <Icon name="Copy" />
          </IconButton>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">{t("common.actions.done")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { InvitationLinkDialog }
