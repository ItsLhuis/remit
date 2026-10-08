import { subscribeClientActivity } from "./clients"
import { subscribeContractActivity } from "./contracts"
import { subscribeCreditNoteActivity } from "./creditNotes"
import { subscribeExpenseActivity } from "./expenses"
import { subscribeInvoiceActivity } from "./invoices"
import { subscribeLeadActivity } from "./leads"
import { subscribePaymentActivity } from "./payments"
import { subscribeProjectActivity } from "./projects"
import { subscribeProposalActivity } from "./proposals"
import { subscribeRecurringInvoiceActivity } from "./recurringInvoices"
import { subscribeTimeEntryActivity } from "./timeTracking"

// The user-facing half of the fan-out described in ARCHITECTURE.md's event bus section: every
// subscription in this folder turns one cross-feature domain event into one `activity_logs` row.
// Handlers register when this module loads, the way `features/*/jobs.ts` register job handlers —
// `instrumentation.ts` imports it for the Next server runtime and `scripts/worker.ts` for the job
// process, because nothing under `lib/` may reach into a feature.
//
// One module per emitting feature, and this one is the only import site: each sibling exports its
// subscriptions as a function rather than registering as an import side effect, so a feed source
// cannot stop registering by losing an import nobody reads. `__tests__/eventSubscriptions.test.ts`
// pins the subscribed event set.
//
// Every value of the `entity_type` enum is written by these modules and no other, which is what lets
// the feed's type filter be generated from the enum instead of hand-listed. Tasks are the deliberate
// absence: they are the highest-volume record in the product, and a feed that announced them would
// bury the documents and money it exists to show, so `task` was removed from the enum rather than
// left as a filter option that can never match.
subscribeClientActivity()
subscribeLeadActivity()
subscribeProjectActivity()
subscribeProposalActivity()
subscribeContractActivity()
subscribeInvoiceActivity()
subscribeRecurringInvoiceActivity()
subscribeCreditNoteActivity()
subscribePaymentActivity()
subscribeTimeEntryActivity()
subscribeExpenseActivity()
