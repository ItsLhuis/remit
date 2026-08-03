"use client"

import { useTranslation } from "@/lib/i18n"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui"

import { type PaymentFormData } from "../types"

import { PaymentForm } from "./PaymentForm"

type PaymentFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
} & (
  | { mode: "create"; invoiceId: string; defaultAmount: string; payment?: never }
  | { mode: "edit"; payment: PaymentFormData; invoiceId?: never; defaultAmount?: never }
)

const PaymentFormSheet = (props: PaymentFormSheetProps) => {
  const { t } = useTranslation()

  const isEdit = props.mode === "edit"

  const handleSuccess = () => {
    props.onOpenChange(false)
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {isEdit ? t("payments.form.editTitle") : t("payments.form.createTitle")}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? t("payments.form.editDescription") : t("payments.form.createDescription")}
          </SheetDescription>
        </SheetHeader>
        {props.mode === "edit" ? (
          <PaymentForm
            mode="edit"
            payment={props.payment}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        ) : (
          <PaymentForm
            mode="create"
            invoiceId={props.invoiceId}
            defaultAmount={props.defaultAmount}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

export { PaymentFormSheet }
