"use client"

import { useTransition } from "react"

import { useRouter } from "next/navigation"

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
  Spinner,
  toast
} from "@/components/ui"

import { cancelRecurringInvoice } from "../mutations"

type CancelRecurringInvoiceDialogProps = {
  recurringInvoiceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CancelRecurringInvoiceDialog = ({
  recurringInvoiceId,
  open,
  onOpenChange
}: CancelRecurringInvoiceDialogProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isCancelling, startCancelling] = useTransition()

  const onConfirm = () => {
    if (isCancelling) return

    startCancelling(async () => {
      const result = await cancelRecurringInvoice({ id: recurringInvoiceId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("recurringInvoices.toasts.cancelled"))

      onOpenChange(false)

      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isCancelling) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recurringInvoices.dialogs.cancel.title")}</DialogTitle>
          <DialogDescription>{t("recurringInvoices.dialogs.cancel.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isCancelling}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isCancelling} onClick={onConfirm}>
            {isCancelling && <Spinner />}
            <Icon name="CircleSlash" aria-hidden="true" />
            {t("recurringInvoices.dialogs.cancel.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { CancelRecurringInvoiceDialog }
