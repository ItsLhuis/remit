"use client"

import { Fragment, useMemo } from "react"

import { useWatch, type Control } from "react-hook-form"

import { isValidAmount, parseAmountToCents } from "@/lib/utils"

import { type CreditNoteFormInputValues } from "../../schemas"
import {
  calculateCreditNoteLineTotals,
  calculateCreditNoteTotal,
  type CreditNoteDiscount,
  type CreditNoteLineItemInput
} from "../../services"
import { type CreditNoteTaxRateOption } from "../../types"

import { CreditNoteLineItemsField } from "./CreditNoteLineItemsField"
import { CreditNoteTotalsPanel } from "./CreditNoteTotalsPanel"

// Mirrors the schema's coercion without its validation: the live totals panel has to price a row the
// moment it is typed, long before the row is valid, so an unparseable amount reads as zero rather
// than blocking the preview. The committed numbers always come from the server, which runs the same
// pure service over the parsed values.
function toCents(value: string): number {
  return isValidAmount(value) ? (parseAmountToCents(value) ?? 0) : 0
}

function toQuantity(value: string): number {
  const quantity = Number(value)

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0
}

function toPreviewDiscount(
  kind: string | undefined,
  percentage: string | undefined,
  amount: string | undefined
): CreditNoteDiscount | null {
  if (kind === "percentage") {
    const value = Number(percentage)

    return { type: "percentage", percentage: Number.isFinite(value) ? Math.min(value, 100) : 0 }
  }

  if (kind === "fixed") return { type: "fixed", amountCents: toCents(amount ?? "") }

  return null
}

function toPreviewLine(
  item: Partial<CreditNoteFormInputValues["lineItems"][number]> | undefined,
  taxPercentages: Map<string, number>
): CreditNoteLineItemInput {
  return {
    quantity: toQuantity(item?.quantity ?? ""),
    unitPriceCents: toCents(item?.unitPrice ?? ""),
    discount: toPreviewDiscount(item?.discountKind, item?.discountPercentage, item?.discountAmount),
    taxPercentage: taxPercentages.get(item?.taxRateId ?? "") ?? 0
  }
}

type CreditNotePricingSectionProps = {
  control: Control<CreditNoteFormInputValues>
  taxRates: CreditNoteTaxRateOption[]
  currency: string
  locale: string
  outstandingCents: number
  errorMessage?: string
  disabled: boolean
}

const CreditNotePricingSection = ({
  control,
  taxRates,
  currency,
  locale,
  outstandingCents,
  errorMessage,
  disabled
}: CreditNotePricingSectionProps) => {
  // Named fields, never the whole form: an unnamed useWatch subscribes to every field, so a
  // keystroke in the reason textarea would re-price the document and re-render every line-item row.
  const lineItems = useWatch({ control, name: "lineItems" })

  const taxPercentages = useMemo(
    () => new Map(taxRates.map((taxRate) => [taxRate.id, taxRate.percentage])),
    [taxRates]
  )

  const previewLines = useMemo(
    () => (lineItems ?? []).map((item) => toPreviewLine(item, taxPercentages)),
    [lineItems, taxPercentages]
  )

  const totals = calculateCreditNoteTotal(previewLines)
  const lineTotals = calculateCreditNoteLineTotals(previewLines)

  return (
    <Fragment>
      <CreditNoteLineItemsField
        control={control}
        taxRates={taxRates}
        currency={currency}
        locale={locale}
        lineTotalsCents={lineTotals.map((line) => line.totalCents)}
        discountKinds={(lineItems ?? []).map((item) => item?.discountKind ?? "none")}
        errorMessage={errorMessage}
        disabled={disabled}
      />
      <CreditNoteTotalsPanel
        totals={totals}
        outstandingCents={outstandingCents}
        currency={currency}
        locale={locale}
      />
    </Fragment>
  )
}

export { CreditNotePricingSection }
