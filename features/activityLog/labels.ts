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
    | "RefreshCw"
    | "Repeat"
    | "Send"
    | "TriangleAlert"
    | "UserPlus"
    | "Wallet"
}

// Keyed on `ActivityMessageKey`, which is itself derived from `Translations`, so it is the compiler
// and not a reviewer that keeps this in step with the `activity.messages` block: a message added
// there and forgotten here fails the build. `isActivityMessageKey` narrows a stored `message_key`
// against this same map, which is why every renderable key is guaranteed to have an icon.
export const activityMessagePresentation: Record<ActivityMessageKey, ActivityMessagePresentation> =
  {
    "activity.messages.clientCreated": { icon: "UserPlus" },
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
    "activity.messages.paymentReceived": { icon: "Banknote" },
    "activity.messages.timeLogged": { icon: "Clock" },
    "activity.messages.expenseCreated": { icon: "Wallet" }
  }

export const activityEntityTypeLabelKeys: Record<ActivityEntityType, ActivityEntityTypeLabelKey> = {
  client: "activity.entityTypes.client",
  project: "activity.entityTypes.project",
  proposal: "activity.entityTypes.proposal",
  invoice: "activity.entityTypes.invoice",
  contract: "activity.entityTypes.contract",
  task: "activity.entityTypes.task",
  time_entry: "activity.entityTypes.timeEntry",
  expense: "activity.entityTypes.expense",
  payment: "activity.entityTypes.payment"
}

export function isActivityMessageKey(value: string): value is ActivityMessageKey {
  return Object.hasOwn(activityMessagePresentation, value)
}

// Proposals, invoices, payments and tasks have no detail route of their own — each is edited from a
// sheet on its list page — so the list is the closest addressable surface an entry can link to.
// Adding a detail route later is the moment to revisit its arm, not a reason to add a fallback now.
export function getActivityEntityHref(entityType: ActivityEntityType, entityId: string): string {
  switch (entityType) {
    case "client":
      return `/clients/${entityId}`
    case "project":
      return `/projects/${entityId}`
    case "contract":
      return `/contracts/${entityId}`
    case "proposal":
      return "/proposals"
    case "invoice":
    case "payment":
      return "/invoices"
    case "task":
      return "/projects"
    case "time_entry":
      return "/time"
    case "expense":
      return "/expenses"
  }
}
