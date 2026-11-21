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

type MarkInvoicePaidDialogProps = {
  open: boolean
  amount: string
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const MarkInvoicePaidDialog = ({
  open,
  amount,
  isSaving,
  onOpenChange,
  onConfirm
}: MarkInvoicePaidDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invoices.markPaid.title")}</DialogTitle>
          <DialogDescription>{t("invoices.markPaid.description", { amount })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" disabled={isSaving} onClick={onConfirm}>
            {isSaving && <Spinner />}
            <Icon name="CircleCheck" aria-hidden="true" />
            {t("invoices.markPaid.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { MarkInvoicePaidDialog }
