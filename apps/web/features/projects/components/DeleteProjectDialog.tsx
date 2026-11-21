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

type DeleteProjectDialogProps = {
  projectName: string
  open: boolean
  isDeleting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const DeleteProjectDialog = ({
  projectName,
  open,
  isDeleting,
  onOpenChange,
  onConfirm
}: DeleteProjectDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("projects.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("projects.delete.description", { name: projectName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isDeleting}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting && <Spinner />}
            {t("projects.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { DeleteProjectDialog }
