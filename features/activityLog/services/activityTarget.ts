import { buildTrashRecordHref } from "@/features/trash/services"

import { type ActivityEntityType } from "../schemas"

// What a feed row needs to know about the record it names, read at render time rather than stored
// on the row: a record is deleted, restored or purged long after the entry was written, and a credit
// note's route runs through its invoice's project, which can change or be cleared.
export type ActivityRecordState = {
  deletedAt: Date | null
  projectId: string | null
  invoiceId: string | null
  invoiceProjectId: string | null
}

export type ActivityTarget =
  | { state: "live"; href: string }
  // `href` is the record's place in the trash, or null for a viewer who cannot open the trash.
  | { state: "trashed"; href: string | null }
  | { state: "gone" }

// Every entity the feed names is one the trash restores, so a deleted record always has a place to
// link to, under the trash's own name for its kind.
const TRASH_KINDS = {
  client: "client",
  lead: "lead",
  project: "project",
  proposal: "proposal",
  invoice: "invoice",
  contract: "contract",
  credit_note: "creditNote",
  recurring_invoice: "recurringInvoice",
  time_entry: "timeEntry",
  expense: "expense",
  payment: "payment"
} as const satisfies Record<ActivityEntityType, string>

export function resolveActivityTarget(
  entityType: ActivityEntityType,
  entityId: string,
  record: ActivityRecordState | undefined,
  { canOpenTrash }: { canOpenTrash: boolean }
): ActivityTarget {
  // No row at all: purged by the retention window, or erased with its client.
  if (!record) return { state: "gone" }

  if (record.deletedAt) {
    return {
      state: "trashed",
      href: canOpenTrash ? buildTrashRecordHref(TRASH_KINDS[entityType], entityId) : null
    }
  }

  return { state: "live", href: getLiveHref(entityType, entityId, record) }
}

// An invoice, its payments and its credit notes are opened under the invoice's project; one raised
// straight against a client has no detail route, and its list is the closest page that shows it.
// Time entries and expenses are edited in sheets on their lists, so the list is where they live.
function getLiveHref(
  entityType: ActivityEntityType,
  entityId: string,
  record: ActivityRecordState
): string {
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
      return `/proposals/${entityId}`
    case "invoice":
      return record.projectId ? `/projects/${record.projectId}/invoices/${entityId}` : "/invoices"
    case "payment":
      return record.invoiceProjectId && record.invoiceId
        ? `/projects/${record.invoiceProjectId}/invoices/${record.invoiceId}`
        : "/invoices"
    case "credit_note":
      return record.invoiceProjectId && record.invoiceId
        ? `/projects/${record.invoiceProjectId}/invoices/${record.invoiceId}/credit-notes/${entityId}`
        : "/credit-notes"
    case "time_entry":
      return "/time"
    case "expense":
      return "/expenses"
  }
}
