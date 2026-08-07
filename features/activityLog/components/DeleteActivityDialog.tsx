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

type DeleteActivityDialogProps = {
  open: boolean
  isDeleting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const DeleteActivityDialog = ({
  open,
  isDeleting,
  onOpenChange,
  onConfirm
}: DeleteActivityDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("activity.feed.deleteTitle")}</DialogTitle>
          <DialogDescription>{t("activity.feed.deleteDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isDeleting}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting && <Spinner />}
            {t("activity.feed.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { DeleteActivityDialog }
