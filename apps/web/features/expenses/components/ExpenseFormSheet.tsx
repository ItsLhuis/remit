"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui"

import { AttachmentsPanel, type AttachmentListItem } from "@/features/attachments"

import { type ExpenseClientOption, type ExpenseFormData, type ExpenseProjectOption } from "../types"

import { ExpenseForm } from "./ExpenseForm"

type ExpenseFormSheetProps = {
  open: boolean
  projectOptions: ExpenseProjectOption[]
  clientOptions: ExpenseClientOption[]
  categoryOptions: string[]
  defaultCurrency: string
  locale: string
  attachments: AttachmentListItem[]
  canWriteAttachments: boolean
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
          // The files panel only exists in edit mode, and deliberately: an attachment needs an
          // `expense_id` to hang off, and a expense being created does not have one yet. It also
          // writes immediately where the form around it writes on submit, which is why it sits below
          // a separator with its own heading rather than reading as another form field. The receipt
          // field inside the form is the expense's own document; this is everything else.
          <>
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
            <Separator />
            <div className="p-4">
              <AttachmentsPanel
                parent={{ parentType: "expense", parentId: props.expense.id }}
                attachments={props.attachments}
                locale={props.locale}
                canWrite={props.canWriteAttachments}
              />
            </div>
          </>
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
