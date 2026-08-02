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

type SendInvoiceDialogProps = {
  open: boolean
  isSending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const SendInvoiceDialog = ({
  open,
  isSending,
  onOpenChange,
  onConfirm
}: SendInvoiceDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invoices.send.title")}</DialogTitle>
          <DialogDescription>{t("invoices.send.description")}</DialogDescription>
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
            {t("invoices.send.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { SendInvoiceDialog }
