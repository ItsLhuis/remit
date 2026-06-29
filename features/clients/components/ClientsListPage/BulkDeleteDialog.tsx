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

type BulkDeleteDialogProps = {
  count: number
  isDeleting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const BulkDeleteDialog = ({
  count,
  isDeleting,
  onOpenChange,
  onConfirm
}: BulkDeleteDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={count > 0} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("clients.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("clients.list.bulkDelete")} ({count})
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isDeleting}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? <Spinner /> : null}
            {t("clients.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { BulkDeleteDialog }
