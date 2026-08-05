import { type RecurringInvoiceBlueprintLine, type RecurringInvoiceLineItemValues } from "../schemas"

// Turns the validated form lines into the shape persisted in `line_items_blueprint`.
//
// The tax percentage is resolved once, here, and frozen into the blueprint rather than re-read at
// generation time. That is the whole point of a blueprint: a schedule authored at 23% must keep
// billing 23% if the rate is later edited, exactly as `conversion.ts` copies a proposal's snapshot
// instead of re-joining `tax_rates` (ADR-0017). Editing the schedule is how the freelancer opts into
// a new rate.
//
// A line with no tax rate is 0%, matching `getTaxPercentage` on the invoice write path.
export function toBlueprintLines(
  lineItems: RecurringInvoiceLineItemValues[],
  taxPercentages: Map<string, number>
): RecurringInvoiceBlueprintLine[] {
  return lineItems.map((item) => ({
    description: item.description,
    unit: item.unit.length > 0 ? item.unit : null,
    quantity: item.quantity,
    unitPriceCents: item.unitPrice,
    taxRateId: item.taxRateId,
    taxPercentage: item.taxRateId === null ? 0 : (taxPercentages.get(item.taxRateId) ?? 0),
    ...toBlueprintDiscount(item)
  }))
}

type BlueprintDiscount = Pick<
  RecurringInvoiceBlueprintLine,
  "discountType" | "discountPercentage" | "discountAmountCents"
>

// `chk_line_items_discount_shape` will apply to the invoice these lines eventually become, so the
// blueprint stores the same exactly-one-populated-column shape rather than carrying both values and
// letting the generation job choose.
function toBlueprintDiscount(item: RecurringInvoiceLineItemValues): BlueprintDiscount {
  if (item.discountKind === "percentage" && item.discountPercentage !== null) {
    return {
      discountType: "percentage",
      discountPercentage: item.discountPercentage,
      discountAmountCents: null
    }
  }

  if (item.discountKind === "fixed" && item.discountAmount !== null) {
    return {
      discountType: "fixed",
      discountPercentage: null,
      discountAmountCents: item.discountAmount
    }
  }

  return { discountType: null, discountPercentage: null, discountAmountCents: null }
}
