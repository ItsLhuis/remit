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
  Spinner,
  toast
} from "@/components/ui"

import { softDeleteRecurringInvoice } from "../mutations"

type DeleteRecurringInvoiceDialogProps = {
  recurringInvoiceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DeleteRecurringInvoiceDialog = ({
  recurringInvoiceId,
  open,
  onOpenChange
}: DeleteRecurringInvoiceDialogProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isDeleting, startDeleting] = useTransition()

  const onConfirm = () => {
    if (isDeleting) return

    startDeleting(async () => {
      const result = await softDeleteRecurringInvoice({ id: recurringInvoiceId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("recurringInvoices.toasts.deleted"))

      onOpenChange(false)

      // The deleted schedule is the subject of the detail route this dialog can be opened from, so
      // refreshing in place would land on a route that no longer resolves. The list is the one
      // surface that still exists afterwards, and navigating to it from the list itself is a no-op.
      router.push("/recurring-invoices")
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isDeleting) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recurringInvoices.dialogs.delete.title")}</DialogTitle>
          <DialogDescription>{t("recurringInvoices.dialogs.delete.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isDeleting}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting && <Spinner />}
            {t("recurringInvoices.dialogs.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { DeleteRecurringInvoiceDialog }
