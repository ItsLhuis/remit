"use client"

import { Fragment, useMemo } from "react"

import { useWatch, type Control } from "react-hook-form"

import { isValidAmount, parseAmountToCents } from "@/lib/utils"

import { type InvoiceFormInputValues } from "../../schemas"
import {
  calculateInvoiceLineTotals,
  calculateInvoiceTotal,
  type InvoiceDiscount,
  type InvoiceLineItemInput
} from "../../services"
import { type InvoiceTaxRateOption } from "../../types"

import { InvoiceLineItemsField } from "./InvoiceLineItemsField"
import { InvoiceTotalsPanel } from "./InvoiceTotalsPanel"

// Mirrors the schema's coercion without its validation: the live totals panel has to price a row
// the moment it is typed, long before the row is valid, so an unparseable amount reads as zero
// rather than blocking the preview. The committed numbers always come from the server, which runs
// the same pure service over the parsed values.
function toCents(value: string): number {
  return isValidAmount(value) ? (parseAmountToCents(value) ?? 0) : 0
}

function toQuantity(value: string): number {
  const quantity = Number(value)

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0
}

function toPreviewLine(
  item: Partial<InvoiceFormInputValues["lineItems"][number]> | undefined,
  taxPercentages: Map<string, number>
): InvoiceLineItemInput {
  return {
    quantity: toQuantity(item?.quantity ?? ""),
    unitPriceCents: toCents(item?.unitPrice ?? ""),
    discount: toPreviewDiscount(item?.discountKind, item?.discountPercentage, item?.discountAmount),
    taxPercentage: taxPercentages.get(item?.taxRateId ?? "") ?? 0
  }
}

function toPreviewDiscount(
  kind: string | undefined,
  percentage: string | undefined,
  amount: string | undefined
): InvoiceDiscount | null {
  if (kind === "percentage") {
    const value = Number(percentage)

    return { type: "percentage", percentage: Number.isFinite(value) ? Math.min(value, 100) : 0 }
  }

  if (kind === "fixed") return { type: "fixed", amountCents: toCents(amount ?? "") }

  return null
}

type InvoicePricingSectionProps = {
  control: Control<InvoiceFormInputValues>
  taxRates: InvoiceTaxRateOption[]
  defaultCurrency: string
  locale: string
  errorMessage?: string
  disabled: boolean
}

const InvoicePricingSection = ({
  control,
  taxRates,
  defaultCurrency,
  locale,
  errorMessage,
  disabled
}: InvoicePricingSectionProps) => {
  // Named fields, never the whole form: an unnamed useWatch subscribes to every field, so a
  // keystroke in the notes textarea would re-price the document and re-render every line-item row.
  // The pricing lives here rather than in InvoiceForm so that the fields above are outside the
  // subscription entirely.
  const [currency, discountKind, discountPercentage, discountAmount, lineItems] = useWatch({
    control,
    name: ["currency", "discountKind", "discountPercentage", "discountAmount", "lineItems"]
  })

  const taxPercentages = useMemo(
    () => new Map(taxRates.map((taxRate) => [taxRate.id, taxRate.percentage])),
    [taxRates]
  )

  const previewLines = useMemo(
    () => (lineItems ?? []).map((item) => toPreviewLine(item, taxPercentages)),
    [lineItems, taxPercentages]
  )

  const previewDiscount = toPreviewDiscount(discountKind, discountPercentage, discountAmount)

  const totals = calculateInvoiceTotal(previewLines, previewDiscount)
  const lineTotals = calculateInvoiceLineTotals(previewLines, previewDiscount)

  const resolvedCurrency = currency ?? defaultCurrency

  return (
    <Fragment>
      <InvoiceLineItemsField
        control={control}
        taxRates={taxRates}
        currency={resolvedCurrency}
        locale={locale}
        lineTotalsCents={lineTotals.map((line) => line.totalCents)}
        discountKinds={(lineItems ?? []).map((item) => item?.discountKind ?? "none")}
        errorMessage={errorMessage}
        disabled={disabled}
      />
      <InvoiceTotalsPanel totals={totals} currency={resolvedCurrency} locale={locale} />
    </Fragment>
  )
}

export { InvoicePricingSection }
