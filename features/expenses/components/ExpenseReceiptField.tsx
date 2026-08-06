"use client"

import { type ChangeEvent, useRef, useTransition } from "react"

import { type Control, Controller } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { Button, Field, FieldDescription, FieldLabel, Icon, Spinner, toast } from "@/components/ui"

import {
  EXPENSE_RECEIPT_MAX_BYTES,
  EXPENSE_RECEIPT_MIME_TYPES,
  type ExpenseFormInputValues
} from "../schemas"

import { ExpenseReceiptLink } from "./ExpenseReceiptLink"

const RECEIPT_MAX_MEGABYTES = EXPENSE_RECEIPT_MAX_BYTES / (1024 * 1024)

function isAllowedReceiptType(value: string): boolean {
  return (EXPENSE_RECEIPT_MIME_TYPES as readonly string[]).includes(value)
}

type ExpenseReceiptFieldProps = {
  control: Control<ExpenseFormInputValues>
  disabled?: boolean
}

const ExpenseReceiptField = ({ control, disabled }: ExpenseReceiptFieldProps) => {
  const { t } = useTranslation()

  const [isUploading, startUploading] = useTransition()

  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <Controller
      name="receipt"
      control={control}
      render={({ field }) => {
        // The file never reaches a server action: it is PUT straight to storage against a key the
        // presign route mints, and only the resulting metadata travels with the form. The action
        // re-validates that metadata, including the `expenses/` key prefix (see schemas.ts).
        const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0]

          if (!file) return

          // Clearing the input before the upload runs is what lets the same file be picked again
          // after a failure; a file input fires no change event when its value is unchanged.
          event.target.value = ""

          if (!isAllowedReceiptType(file.type)) {
            toast.error(t("expenses.errors.invalidFileType"))

            return
          }

          if (file.size > EXPENSE_RECEIPT_MAX_BYTES) {
            toast.error(
              t("expenses.validation.receiptTooLarge", { megabytes: RECEIPT_MAX_MEGABYTES })
            )

            return
          }

          const mimeType = file.type

          startUploading(async () => {
            const presignResponse = await fetch("/api/upload/expense-receipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename: file.name,
                contentType: mimeType,
                sizeBytes: file.size
              })
            })

            if (!presignResponse.ok) {
              toast.error(t("expenses.errors.uploadUrlFailed"))

              return
            }

            const { uploadUrl, objectKey } = (await presignResponse.json()) as {
              uploadUrl: string
              objectKey: string
            }

            const putResponse = await fetch(uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": mimeType },
              body: file
            })

            if (!putResponse.ok) {
              toast.error(t("expenses.errors.uploadFailed"))

              return
            }

            field.onChange({ objectKey, filename: file.name, mimeType, sizeBytes: file.size })
          })
        }

        return (
          <Field>
            <FieldLabel htmlFor={field.name}>{t("expenses.fields.receipt")}</FieldLabel>
            <input
              ref={fileInputRef}
              id={field.name}
              type="file"
              accept={EXPENSE_RECEIPT_MIME_TYPES.join(",")}
              className="hidden"
              aria-label={t("expenses.receipt.upload")}
              onChange={handleFileChange}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading && <Spinner />}
                <Icon name="Upload" aria-hidden="true" />
                {field.value ? t("expenses.receipt.replace") : t("expenses.receipt.upload")}
              </Button>
              {field.value ? (
                <ExpenseReceiptLink
                  filename={field.value.filename}
                  objectKey={field.value.objectKey}
                  className="min-w-0 flex-1"
                />
              ) : null}
              {field.value ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || isUploading}
                  onClick={() => field.onChange(null)}
                >
                  <Icon name="X" aria-hidden="true" />
                  {t("expenses.receipt.remove")}
                </Button>
              ) : null}
            </div>
            <FieldDescription>
              {t("expenses.receipt.help", { megabytes: RECEIPT_MAX_MEGABYTES })}
            </FieldDescription>
          </Field>
        )
      }}
    />
  )
}

export { ExpenseReceiptField }
