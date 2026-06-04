"use client"

import { type TaxRateListItem } from "../schemas"

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

type DeleteTaxRateDialogProps = {
  taxRate: TaxRateListItem | null
  isDeleting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const DeleteTaxRateDialog = ({
  taxRate,
  isDeleting,
  onOpenChange,
  onConfirm
}: DeleteTaxRateDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={Boolean(taxRate)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.taxRates.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {taxRate
              ? t("settings.taxRates.deleteDescription", { name: taxRate.name })
              : t("settings.taxRates.deleteDescriptionFallback")}
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
            {t("settings.taxRates.confirmDelete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { DeleteTaxRateDialog }
