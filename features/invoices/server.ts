export {
  createInvoice,
  markInvoicePaid,
  sendInvoice,
  softDeleteInvoice,
  updateInvoice
} from "./mutations"

export { createInvoiceFromProposal } from "./conversion"

export {
  writeSystemInvoice,
  type SystemInvoiceInput,
  type SystemInvoiceResult
} from "./systemWrites"

export {
  claimInvoiceNumber,
  writeInvoiceLineItems,
  ExpectedInvoiceError,
  type InvoiceLineItemRow,
  type InvoiceTransaction
} from "./invoiceWrites"

export {
  getInvoiceDefaults,
  getInvoiceDetail,
  getInvoiceEditorData,
  getInvoiceForEdit,
  getInvoicesPageData,
  listBillableTargetInvoices,
  listConvertibleProposals,
  listInvoicesByClient,
  listInvoicesByProject
} from "./queries"

export { getInvoiceOverviewPageData } from "./overviewQueries"

export { getPublicInvoice } from "./publicQueries"

export { startPublicInvoiceCheckout } from "./publicCheckout"

export { recordPublicInvoiceView } from "./publicView"

export {
  emitInvoiceCreated,
  emitInvoiceDeleted,
  emitInvoiceOverdue,
  emitInvoicePaid,
  emitInvoiceReminderSent,
  emitInvoiceSent,
  emitInvoiceUpdated
} from "./events"

// Also exported from the client-safe `index.ts`, and reachable from a server module without it:
// `features/dashboard/queries.ts` needs the overdue rule to agree with the badge this feature
// renders, and reaching it through the root barrel would drag the whole invoice component graph
// into a server-only read.
export { isInvoiceOverdue } from "./services"
