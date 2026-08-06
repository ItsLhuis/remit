"use client"

import { useTranslation } from "@/lib/i18n"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui"

import { type ExpenseClientOption, type ExpenseFormData, type ExpenseProjectOption } from "../types"

import { ExpenseForm } from "./ExpenseForm"

type ExpenseFormSheetProps = {
  open: boolean
  projectOptions: ExpenseProjectOption[]
  clientOptions: ExpenseClientOption[]
  categoryOptions: string[]
  defaultCurrency: string
  onOpenChange: (open: boolean) => void
  onSuccess?: (expense: { id: string }) => void
} & ({ mode: "create"; expense?: never } | { mode: "edit"; expense: ExpenseFormData })

const ExpenseFormSheet = (props: ExpenseFormSheetProps) => {
  const { t } = useTranslation()

  const isEdit = props.mode === "edit"

  const handleSuccess = (expense: { id: string }) => {
    props.onSuccess?.(expense)
    props.onOpenChange(false)
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {isEdit ? t("expenses.form.editTitle") : t("expenses.form.createTitle")}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? t("expenses.form.editDescription") : t("expenses.form.createDescription")}
          </SheetDescription>
        </SheetHeader>
        {props.mode === "edit" ? (
          <ExpenseForm
            mode="edit"
            expense={props.expense}
            projectOptions={props.projectOptions}
            clientOptions={props.clientOptions}
            categoryOptions={props.categoryOptions}
            defaultCurrency={props.defaultCurrency}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        ) : (
          <ExpenseForm
            mode="create"
            projectOptions={props.projectOptions}
            clientOptions={props.clientOptions}
            categoryOptions={props.categoryOptions}
            defaultCurrency={props.defaultCurrency}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

export { ExpenseFormSheet }
