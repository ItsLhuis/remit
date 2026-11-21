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
  Icon,
  Spinner
} from "@/components/ui"

type SendContractDialogProps = {
  open: boolean
  isSending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const SendContractDialog = ({
  open,
  isSending,
  onOpenChange,
  onConfirm
}: SendContractDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("contracts.dialogs.send.title")}</DialogTitle>
          <DialogDescription>{t("contracts.dialogs.send.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSending}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" disabled={isSending} onClick={onConfirm}>
            {isSending && <Spinner />}
            <Icon name="Send" aria-hidden="true" />
            {t("contracts.dialogs.send.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { SendContractDialog }
