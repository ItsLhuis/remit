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

import { pauseRecurringInvoice } from "../mutations"

type PauseRecurringInvoiceDialogProps = {
  recurringInvoiceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PauseRecurringInvoiceDialog = ({
  recurringInvoiceId,
  open,
  onOpenChange
}: PauseRecurringInvoiceDialogProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPausing, startPausing] = useTransition()

  const onConfirm = () => {
    if (isPausing) return

    startPausing(async () => {
      const result = await pauseRecurringInvoice({ id: recurringInvoiceId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("recurringInvoices.toasts.paused"))

      onOpenChange(false)

      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPausing) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recurringInvoices.dialogs.pause.title")}</DialogTitle>
          <DialogDescription>{t("recurringInvoices.dialogs.pause.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPausing}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" disabled={isPausing} onClick={onConfirm}>
            {isPausing && <Spinner />}
            <Icon name="Pause" aria-hidden="true" />
            {t("recurringInvoices.dialogs.pause.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { PauseRecurringInvoiceDialog }
