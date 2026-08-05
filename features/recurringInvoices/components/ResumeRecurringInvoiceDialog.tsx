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

import { resumeRecurringInvoice } from "../mutations"

type ResumeRecurringInvoiceDialogProps = {
  recurringInvoiceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ResumeRecurringInvoiceDialog = ({
  recurringInvoiceId,
  open,
  onOpenChange
}: ResumeRecurringInvoiceDialogProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isResuming, startResuming] = useTransition()

  const onConfirm = () => {
    if (isResuming) return

    startResuming(async () => {
      const result = await resumeRecurringInvoice({ id: recurringInvoiceId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("recurringInvoices.toasts.resumed"))

      onOpenChange(false)

      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isResuming) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recurringInvoices.dialogs.resume.title")}</DialogTitle>
          <DialogDescription>{t("recurringInvoices.dialogs.resume.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isResuming}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" disabled={isResuming} onClick={onConfirm}>
            {isResuming && <Spinner />}
            <Icon name="Play" aria-hidden="true" />
            {t("recurringInvoices.dialogs.resume.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ResumeRecurringInvoiceDialog }
