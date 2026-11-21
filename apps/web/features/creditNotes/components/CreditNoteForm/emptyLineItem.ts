import { type CreditNoteFormInputValues } from "../../schemas"

// The blank row `CreditNoteLineItemsField` appends and `CreditNoteForm` seeds a new credit note
// with. It lives outside both so neither component file exports a non-component, which would cost
// the other its Fast Refresh state.
export const EMPTY_LINE_ITEM: CreditNoteFormInputValues["lineItems"][number] = {
  description: "",
  unit: "",
  quantity: "1",
  unitPrice: "",
  discountKind: "none",
  discountPercentage: "",
  discountAmount: "",
  taxRateId: ""
}
