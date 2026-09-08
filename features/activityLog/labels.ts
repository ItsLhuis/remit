import { type ActivityEntityType } from "./schemas"
import { type ActivityEntityTypeLabelKey, type ActivityMessageKey } from "./types"

type ActivityMessagePresentation = {
  icon:
    | "Banknote"
    | "CircleCheckBig"
    | "CircleX"
    | "Clock"
    | "FileSignature"
    | "FolderPlus"
    | "HandCoins"
    | "RefreshCw"
    | "Repeat"
    | "Send"
    | "TimerOff"
    | "TriangleAlert"
    | "UserPlus"
    | "UserRoundCheck"
    | "Wallet"
}

// Keyed on `ActivityMessageKey`, which is itself derived from `Translations`, so it is the compiler
// and not a reviewer that keeps this in step with the `activity.messages` block: a message added
// there and forgotten here fails the build. `isActivityMessageKey` narrows a stored `message_key`
// against this same map, which is why every renderable key is guaranteed to have an icon.
export const activityMessagePresentation: Record<ActivityMessageKey, ActivityMessagePresentation> =
  {
    "activity.messages.clientCreated": { icon: "UserPlus" },
    "activity.messages.leadConverted": { icon: "UserRoundCheck" },
    "activity.messages.projectCreated": { icon: "FolderPlus" },
    "activity.messages.projectStatusChanged": { icon: "RefreshCw" },
    "activity.messages.proposalSent": { icon: "Send" },
    "activity.messages.proposalAccepted": { icon: "CircleCheckBig" },
    "activity.messages.proposalRejected": { icon: "CircleX" },
    "activity.messages.contractSigned": { icon: "FileSignature" },
    "activity.messages.invoiceSent": { icon: "Send" },
    "activity.messages.invoicePaid": { icon: "CircleCheckBig" },
    "activity.messages.invoiceOverdue": { icon: "TriangleAlert" },
    "activity.messages.invoiceLateFeeApplied": { icon: "TriangleAlert" },
    "activity.messages.invoiceGenerated": { icon: "Repeat" },
    "activity.messages.retainerPoolExhausted": { icon: "TimerOff" },
    "activity.messages.creditNoteIssued": { icon: "HandCoins" },
    "activity.messages.paymentReceived": { icon: "Banknote" },
    "activity.messages.timeLogged": { icon: "Clock" },
    "activity.messages.expenseCreated": { icon: "Wallet" }
  }

export const activityEntityTypeLabelKeys: Record<ActivityEntityType, ActivityEntityTypeLabelKey> = {
  client: "activity.entityTypes.client",
  lead: "activity.entityTypes.lead",
  project: "activity.entityTypes.project",
  proposal: "activity.entityTypes.proposal",
  invoice: "activity.entityTypes.invoice",
  contract: "activity.entityTypes.contract",
  credit_note: "activity.entityTypes.creditNote",
  recurring_invoice: "activity.entityTypes.recurringInvoice",
  time_entry: "activity.entityTypes.timeEntry",
  expense: "activity.entityTypes.expense",
  payment: "activity.entityTypes.payment"
}

export function isActivityMessageKey(value: string): value is ActivityMessageKey {
  return Object.hasOwn(activityMessagePresentation, value)
}

// Proposals, invoices and payments have no detail route of their own — each is edited from a sheet
// on its list page — so the list is the closest addressable surface an entry can link to. A credit
// note does have one, but only under its invoice's project, and a feed row carries no parent ids;
// the global list is what it can reach. Adding a detail route later is the moment to revisit an arm,
// not a reason to add a fallback now.
export function getActivityEntityHref(entityType: ActivityEntityType, entityId: string): string {
  switch (entityType) {
    case "client":
      return `/clients/${entityId}`
    case "lead":
      return `/leads/${entityId}`
    case "project":
      return `/projects/${entityId}`
    case "contract":
      return `/contracts/${entityId}`
    case "recurring_invoice":
      return `/recurring-invoices/${entityId}`
    case "proposal":
      return "/proposals"
    case "invoice":
    case "payment":
      return "/invoices"
    case "credit_note":
      return "/credit-notes"
    case "time_entry":
      return "/time"
    case "expense":
      return "/expenses"
  }
}
