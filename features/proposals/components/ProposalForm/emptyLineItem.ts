import { type ProposalFormInputValues } from "../../schemas"

// The blank row `ProposalLineItemsField` appends and `ProposalForm` seeds a new proposal with. It
// lives outside both so neither component file exports a non-component, which would cost the other
// its Fast Refresh state.
export const EMPTY_LINE_ITEM: ProposalFormInputValues["lineItems"][number] = {
  description: "",
  unit: "",
  quantity: "1",
  unitPrice: "",
  discountKind: "none",
  discountPercentage: "",
  discountAmount: "",
  taxRateId: ""
}
