"use client"

import { useFieldArray, type Control } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { Button, FieldError, Icon, Typography } from "@/components/ui"

import { type InvoiceFormInputValues } from "../../schemas"
import { type InvoiceTaxRateOption } from "../../types"

import { EMPTY_LINE_ITEM } from "./emptyLineItem"
import { InvoiceLineItemRow } from "./InvoiceLineItemRow"

type InvoiceLineItemsFieldProps = {
  control: Control<InvoiceFormInputValues>
  taxRates: InvoiceTaxRateOption[]
  currency: string
  locale: string
  lineTotalsCents: number[]
  discountKinds: string[]
  errorMessage?: string
  disabled: boolean
}

const InvoiceLineItemsField = ({
  control,
  taxRates,
  currency,
  locale,
  lineTotalsCents,
  discountKinds,
  errorMessage,
  disabled
}: InvoiceLineItemsFieldProps) => {
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
        <InvoiceLineItemRow
          key={field.id}
          control={control}
          index={index}
          taxRates={taxRates}
          currency={currency}
          locale={locale}
          lineTotalCents={lineTotalsCents[index] ?? 0}
          discountKind={discountKinds[index] ?? "none"}
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
        {t("invoices.lineItems.addButton")}
      </Button>
    </div>
  )
}

export { InvoiceLineItemsField }
