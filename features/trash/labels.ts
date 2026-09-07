import { type TrashEntityKind } from "./schemas"

// `as const satisfies` rather than an annotation, as in `features/dataExport/labels.ts`: the label
// keys have to stay literal types for the typed `t()` to accept them, which an annotation would
// widen away.
export const trashEntityLabelKeys = {
  client: "trash.entities.client",
  clientContact: "trash.entities.clientContact",
  contract: "trash.entities.contract",
  creditNote: "trash.entities.creditNote",
  expense: "trash.entities.expense",
  invoice: "trash.entities.invoice",
  lead: "trash.entities.lead",
  payment: "trash.entities.payment",
  project: "trash.entities.project",
  proposal: "trash.entities.proposal",
  recurringInvoice: "trash.entities.recurringInvoice",
  task: "trash.entities.task",
  taxRate: "trash.entities.taxRate",
  template: "trash.entities.template",
  timeEntry: "trash.entities.timeEntry"
} as const satisfies Record<TrashEntityKind, string>
