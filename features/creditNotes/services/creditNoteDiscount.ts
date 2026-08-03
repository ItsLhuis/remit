import { type CreditNoteDiscountKind } from "../schemas"

import { type CreditNoteDiscount } from "./calculateCreditNoteTotal"

// The three shapes a line discount takes in this feature and the mapping between them:
//
//   form    — a kind plus two optional fields, because a select cannot carry a variant
//   columns — the `discount_type` / `discount_percentage` / `discount_amount_cents` triple that
//             `chk_line_items_discount_shape` constrains
//   value   — the discriminated union the totals service takes
//
// Only line items carry a discount here: `credit_notes` has no document-level discount columns, so
// unlike features/invoices/services/invoiceDiscount.ts there is no second caller shape to map.
export type CreditNoteDiscountColumns = {
  discountType: "percentage" | "fixed" | null
  discountPercentage: string | null
  discountAmountCents: number | null
}

export type CreditNoteDiscountValues = {
  discountKind: CreditNoteDiscountKind
  discountPercentage: number | null
  discountAmount: number | null
}

export function toCreditNoteDiscount(values: CreditNoteDiscountValues): CreditNoteDiscount | null {
  if (values.discountKind === "percentage" && values.discountPercentage !== null) {
    return { type: "percentage", percentage: values.discountPercentage }
  }

  if (values.discountKind === "fixed" && values.discountAmount !== null) {
    return { type: "fixed", amountCents: values.discountAmount }
  }

  return null
}

export function toCreditNoteDiscountColumns(
  values: CreditNoteDiscountValues
): CreditNoteDiscountColumns {
  const discount = toCreditNoteDiscount(values)

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
