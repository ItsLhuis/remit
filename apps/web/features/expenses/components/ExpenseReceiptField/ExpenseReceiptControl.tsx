"use client"

import { useTranslation } from "@/lib/i18n"

import { Button, Field, FieldDescription, FieldLabel, FileDropzone, Icon } from "@/components/ui"

import { useFileUpload } from "@/hooks"

import {
  EXPENSE_RECEIPT_MAX_BYTES,
  EXPENSE_RECEIPT_MIME_TYPES,
  type ExpenseFormInputValues
} from "../../schemas"
import { ExpenseReceiptLink } from "../ExpenseReceiptLink"

const RECEIPT_MAX_MEGABYTES = EXPENSE_RECEIPT_MAX_BYTES / (1024 * 1024)

type ExpenseReceiptControlProps = {
  disabled?: boolean
  name: string
  value: ExpenseFormInputValues["receipt"]
  onChange: (value: ExpenseFormInputValues["receipt"]) => void
}

// Split out of `ExpenseReceiptField` only because `useFileUpload` is a hook and a hook cannot be
// called inside `Controller`'s render prop.
const ExpenseReceiptControl = ({ disabled, name, value, onChange }: ExpenseReceiptControlProps) => {
  const { t } = useTranslation()

  const { isUploading, upload } = useFileUpload({
    type: "expense-receipt",
    maxBytes: EXPENSE_RECEIPT_MAX_BYTES,
    mimeTypes: EXPENSE_RECEIPT_MIME_TYPES,
    onUploaded: (result) => {
      onChange({
        objectKey: result.objectKey,
        filename: result.filename,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes
      })
    }
  })

  return (
    <Field>
      <FieldLabel htmlFor={name}>{t("expenses.fields.receipt")}</FieldLabel>
      <FileDropzone
        size="compact"
        accept={EXPENSE_RECEIPT_MIME_TYPES}
        disabled={disabled || isUploading}
        label={value ? t("expenses.receipt.replace") : t("expenses.receipt.upload")}
        dropLabel={t("expenses.receipt.drop")}
        onFiles={upload}
      />
      {value ? (
        <div className="flex flex-wrap items-center gap-2">
          <ExpenseReceiptLink
            filename={value.filename}
            objectKey={value.objectKey}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isUploading}
            onClick={() => onChange(null)}
          >
            <Icon name="X" aria-hidden="true" />
            {t("expenses.receipt.remove")}
          </Button>
        </div>
      ) : null}
      <FieldDescription>
        {t("expenses.receipt.help", { megabytes: RECEIPT_MAX_MEGABYTES })}
      </FieldDescription>
    </Field>
  )
}

export { ExpenseReceiptControl }
