"use client"

import { useFieldArray, type Control } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { Button, FieldError, Icon, Typography } from "@/components/ui"

import { type ProposalFormInputValues } from "../../schemas"
import { type ProposalTaxRateOption } from "../../types"

import { EMPTY_LINE_ITEM } from "./emptyLineItem"
import { ProposalLineItemRow } from "./ProposalLineItemRow"

type ProposalLineItemsFieldProps = {
  control: Control<ProposalFormInputValues>
  taxRates: ProposalTaxRateOption[]
  currency: string
  locale: string
  lineTotalsCents: number[]
  discountKinds: string[]
  errorMessage?: string
  disabled: boolean
}

const ProposalLineItemsField = ({
  control,
  taxRates,
  currency,
  locale,
  lineTotalsCents,
  discountKinds,
  errorMessage,
  disabled
}: ProposalLineItemsFieldProps) => {
  const { t } = useTranslation()

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" })

  return (
    <div className="flex flex-col gap-4">
      {fields.length === 0 ? (
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {t("proposals.lineItems.empty")}
        </Typography>
      ) : null}
      {fields.map((field, index) => (
        <ProposalLineItemRow
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
        {t("proposals.lineItems.addButton")}
      </Button>
    </div>
  )
}

export { ProposalLineItemsField }
