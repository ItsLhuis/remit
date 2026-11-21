import { type InvoiceDiscountKind } from "../schemas"

import { type InvoiceDiscount } from "./calculateInvoiceTotal"

// The three shapes a discount takes in this feature and the mapping between them:
//
//   form    — a kind plus two optional fields, because a select cannot carry a variant
//   columns — the `discount_type` / `discount_percentage` / `discount_amount_cents` triple that
//             `chk_invoices_discount_shape` and `chk_line_items_discount_shape` constrain
//   value   — the discriminated union the totals service takes
//
// Keeping the conversions here means the create path, the update path, and the proposal-conversion
// path all read a persisted or submitted discount the same way; a fourth caller cannot invent a
// fourth interpretation.
export type InvoiceDiscountColumns = {
  discountType: "percentage" | "fixed" | null
  discountPercentage: string | null
  discountAmountCents: number | null
}

export type InvoiceDiscountValues = {
  discountKind: InvoiceDiscountKind
  discountPercentage: number | null
  discountAmount: number | null
}

export function toInvoiceDiscount(values: InvoiceDiscountValues): InvoiceDiscount | null {
  if (values.discountKind === "percentage" && values.discountPercentage !== null) {
    return { type: "percentage", percentage: values.discountPercentage }
  }

  if (values.discountKind === "fixed" && values.discountAmount !== null) {
    return { type: "fixed", amountCents: values.discountAmount }
  }

  return null
}

export function toInvoiceColumnDiscount(columns: InvoiceDiscountColumns): InvoiceDiscount | null {
  if (columns.discountType === "percentage" && columns.discountPercentage !== null) {
    return { type: "percentage", percentage: Number(columns.discountPercentage) }
  }

  if (columns.discountType === "fixed" && columns.discountAmountCents !== null) {
    return { type: "fixed", amountCents: columns.discountAmountCents }
  }

  return null
}

export function toInvoiceDiscountColumns(values: InvoiceDiscountValues): InvoiceDiscountColumns {
  const discount = toInvoiceDiscount(values)

  if (!discount) return { discountType: null, discountPercentage: null, discountAmountCents: null }

  if (discount.type === "percentage") {
    return {
      discountType: "percentage",
      discountPercentage: String(discount.percentage),
      discountAmountCents: null
    }
  }

  return {
    discountType: "fixed",
    discountPercentage: null,
    discountAmountCents: discount.amountCents
  }
}
