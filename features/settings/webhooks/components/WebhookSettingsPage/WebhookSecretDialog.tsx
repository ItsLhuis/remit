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
  SecretReveal
} from "@/components/ui"

type WebhookSecretDialogProps = {
  secret: string | null
  onOpenChange: (open: boolean) => void
}

const WebhookSecretDialog = ({ secret, onOpenChange }: WebhookSecretDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={Boolean(secret)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.webhooks.secretTitle")}</DialogTitle>
          <DialogDescription>{t("settings.webhooks.secretDescription")}</DialogDescription>
        </DialogHeader>
        <SecretReveal
          id="webhook-secret-value"
          label={t("settings.webhooks.secretLabel")}
          value={secret ?? ""}
          warningTitle={t("settings.webhooks.secretWarningTitle")}
          warningDescription={t("settings.webhooks.secretWarningDescription")}
          copyLabel={t("settings.webhooks.copySecret")}
          copiedLabel={t("settings.webhooks.copied")}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">{t("common.actions.done")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { WebhookSecretDialog }
