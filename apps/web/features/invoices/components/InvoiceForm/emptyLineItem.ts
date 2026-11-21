import { type InvoiceFormInputValues } from "../../schemas"

// The blank row `InvoiceLineItemsField` appends and `InvoiceForm` seeds a new invoice with. It lives
// outside both so neither component file exports a non-component, which would cost the other its
// Fast Refresh state.
export const EMPTY_LINE_ITEM: InvoiceFormInputValues["lineItems"][number] = {
  description: "",
  unit: "",
  quantity: "1",
  unitPrice: "",
  discountKind: "none",
  discountPercentage: "",
  discountAmount: "",
  taxRateId: ""
}
