"use client"

import { useFieldArray, type Control } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { Button, FieldError, Icon, Typography } from "@/components/ui"

import { type RecurringInvoiceFormInputValues } from "../../schemas"
import { type RecurringInvoiceTaxRateOption } from "../../types"

import { EMPTY_LINE_ITEM } from "./emptyLineItem"
import { RecurringInvoiceLineItemRow } from "./RecurringInvoiceLineItemRow"

type RecurringInvoiceLineItemsFieldProps = {
  control: Control<RecurringInvoiceFormInputValues>
  taxRates: RecurringInvoiceTaxRateOption[]
  errorMessage?: string
  disabled: boolean
}

const RecurringInvoiceLineItemsField = ({
  control,
  taxRates,
  errorMessage,
  disabled
}: RecurringInvoiceLineItemsFieldProps) => {
  const { t } = useTranslation()

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" })

  return (
    <div className="flex flex-col gap-4">
      {fields.length === 0 ? (
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {t("invoices.lineItems.empty")}
        </Typography>
      ) : null}
      {fields.map((field, index) => (
        <RecurringInvoiceLineItemRow
          key={field.id}
          control={control}
          index={index}
          taxRates={taxRates}
          canRemove={fields.length > 1}
          disabled={disabled}
          onRemove={remove}
        />
      ))}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={disabled}
        onClick={() => append(EMPTY_LINE_ITEM)}
      >
        <Icon name="Plus" aria-hidden="true" />
        {t("recurringInvoices.form.addLineItem")}
      </Button>
    </div>
  )
}

export { RecurringInvoiceLineItemsField }
