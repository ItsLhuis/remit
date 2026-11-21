import { type RecurringInvoiceFormInputValues } from "../../schemas"

// The blank row `RecurringInvoiceLineItemsField` appends and `RecurringInvoiceForm` seeds a new
// schedule with. It lives outside both so neither component file exports a non-component, which
// would cost the other its Fast Refresh state.
export const EMPTY_LINE_ITEM: RecurringInvoiceFormInputValues["lineItems"][number] = {
  description: "",
  unit: "",
  quantity: "1",
  unitPrice: "",
  discountKind: "none",
  discountPercentage: "",
  discountAmount: "",
  taxRateId: ""
}
