import { eq } from "drizzle-orm"

import { on } from "@/lib/events"

import { logger } from "@/lib/logger"

import { database } from "@/database"
import {
  activityLogs,
  clients,
  contracts,
  creditNotes,
  expenses,
  invoices,
  leads,
  payments,
  projects,
  proposals,
  recurringInvoices,
  timeEntries
} from "@/database/schema"

// Through the server barrel rather than the client-safe root one: this file is bundled into the
// worker process, and `features/leads/index.ts` re-exports the feature's React components.
import { formatLeadName } from "@/features/leads/server"

import { type ActivityEntityType, type ActivityMessageArgs } from "./schemas"
import { type ActivityMessageKey } from "./types"

type ActivityRecord = {
  entityType: ActivityEntityType
  entityId: string
  action: string
  messageKey: ActivityMessageKey
  messageArgs: ActivityMessageArgs
}

const SECONDS_PER_HOUR = 3600

// The user-facing half of the fan-out described in ARCHITECTURE.md's event bus section: every
// subscription here turns one cross-feature domain event into one `activity_logs` row. Handlers
// register at module load, the way `features/*/jobs.ts` register job handlers — `instrumentation.ts`
// imports this file for the Next server runtime and `scripts/worker.ts` for the job process, because
// nothing under `lib/` may reach into a feature.
//
// Every value of the `entity_type` enum is written here and no other, which is what lets the feed's
// type filter be generated from the enum instead of hand-listed. Tasks are the deliberate absence:
// they are the highest-volume record in the product, and a feed that announced them would bury the
// documents and money it exists to show, so `task` was removed from the enum rather than left as a
// filter option that can never match.
on("client.created", ({ clientId }) => record("client.created", () => buildClientCreated(clientId)))

// A conversion writes this row and, through `createClient`, a `client.created` row too. They are two
// facts about two records with two click-throughs — a pursuit ended, and a client now exists — which
// is the same shape as a settling payment writing both a `payment` and an `invoice` row. Only the
// intermediate lead stages are refused: five of them per lead would crowd out everything else, and
// the leads board already shows and filters on that status.
on("lead.converted", ({ leadId }) => record("lead.converted", () => buildLeadConverted(leadId)))

on("project.created", ({ projectId }) =>
  record("project.created", () => buildProjectCreated(projectId))
)

on("project.status_changed", ({ projectId, to }) =>
  record("project.status_changed", () => buildProjectStatusChanged(projectId, to))
)

on("proposal.sent", ({ proposalId }) =>
  record("proposal.sent", () => buildProposalActivity(proposalId, "sent", "proposalSent"))
)

on("proposal.accepted", ({ proposalId }) =>
  record("proposal.accepted", () =>
    buildProposalActivity(proposalId, "accepted", "proposalAccepted")
  )
)

on("proposal.rejected", ({ proposalId }) =>
  record("proposal.rejected", () =>
    buildProposalActivity(proposalId, "rejected", "proposalRejected")
  )
)

on("contract.signed", ({ contractId }) =>
  record("contract.signed", () => buildContractSigned(contractId))
)

on("invoice.sent", ({ invoiceId }) =>
  record("invoice.sent", () => buildInvoiceActivity(invoiceId, "sent", "invoiceSent"))
)

on("invoice.paid", ({ invoiceId }) =>
  record("invoice.paid", () => buildInvoiceActivity(invoiceId, "paid", "invoicePaid"))
)

on("invoice.overdue", ({ invoiceId, daysOverdue }) =>
  record("invoice.overdue", () => buildInvoiceOverdue(invoiceId, daysOverdue))
)

on("invoice.late_fee_applied", ({ invoiceId }) =>
  record("invoice.late_fee_applied", () => buildInvoiceLateFeeApplied(invoiceId))
)

// Filed under the invoice the run produced, not under the schedule: the invoice is what the reader
// acts on, and a second row naming the schedule would announce one overnight run twice. The schedule
// gets its own row only for exhaustion below, which is a different fact the invoice does not carry.
on("recurring.invoice_generated", ({ invoiceId, occurrence }) =>
  record("recurring.invoice_generated", () => buildInvoiceGenerated(invoiceId, occurrence))
)

on("retainer.pool_exhausted", ({ recurringInvoiceId, includedHours, consumedHours }) =>
  record("retainer.pool_exhausted", () =>
    buildRetainerPoolExhausted(recurringInvoiceId, includedHours, consumedHours)
  )
)

on("credit_note.issued", ({ creditNoteId, invoiceId }) =>
  record("credit_note.issued", () => buildCreditNoteIssued(creditNoteId, invoiceId))
)

on("payment.received", ({ paymentId, invoiceId }) =>
  record("payment.received", () => buildPaymentReceived(paymentId, invoiceId))
)

on("time.logged", ({ timeEntryId, projectId, durationSeconds }) =>
  record("time.logged", () => buildTimeLogged(timeEntryId, projectId, durationSeconds))
)

on("expense.created", ({ expenseId }) =>
  record("expense.created", () => buildExpenseCreated(expenseId))
)

async function record(event: string, build: () => Promise<ActivityRecord | null>): Promise<void> {
  try {
    const entry = await build()

    // A builder returns null when the row the event names is already gone, which a delete racing an
    // emit can produce. Writing an entry with no label would put an untranslatable blank in the feed.
    if (!entry) return

    await database.insert(activityLogs).values(entry)
  } catch (error) {
    // Swallowed rather than rethrown, as `.agents/rules/events.md` requires: `lib/events/bus.ts`
    // awaits handlers inside the emitting action's write path, so letting this escape would fail a
    // real invoice or payment for the sake of a history entry.
    logger.error({ action: "activityLog.record", event, err: error }, "Activity log write failed")
  }
}

async function buildClientCreated(clientId: string): Promise<ActivityRecord | null> {
  const row = await database.query.clients.findFirst({
    where: eq(clients.id, clientId),
    columns: { name: true }
  })

  if (!row) return null

  return {
    entityType: "client",
    entityId: clientId,
    action: "created",
    messageKey: "activity.messages.clientCreated",
    messageArgs: { name: row.name }
  }
}

async function buildLeadConverted(leadId: string): Promise<ActivityRecord | null> {
  const row = await database.query.leads.findFirst({
    where: eq(leads.id, leadId),
    columns: { firstName: true, lastName: true, company: true, email: true }
  })

  if (!row) return null

  return {
    entityType: "lead",
    entityId: leadId,
    action: "converted",
    messageKey: "activity.messages.leadConverted",
    messageArgs: {
      name: formatLeadName({
        firstName: row.firstName ?? "",
        lastName: row.lastName ?? "",
        company: row.company ?? "",
        email: row.email
      })
    }
  }
}

async function buildProjectCreated(projectId: string): Promise<ActivityRecord | null> {
  const name = await findProjectName(projectId)

  if (name === null) return null

  return {
    entityType: "project",
    entityId: projectId,
    action: "created",
    messageKey: "activity.messages.projectCreated",
    messageArgs: { name }
  }
}

async function buildProjectStatusChanged(
  projectId: string,
  status: string
): Promise<ActivityRecord | null> {
  const name = await findProjectName(projectId)

  if (name === null) return null

  // `status` travels raw. The message resolves it through an ICU `select`, so the stored row stays
  // locale-independent and a status added to the enum degrades to the `other` arm instead of
  // freezing yesterday's English into the history.
  return {
    entityType: "project",
    entityId: projectId,
    action: "status_changed",
    messageKey: "activity.messages.projectStatusChanged",
    messageArgs: { name, status }
  }
}

async function buildProposalActivity(
  proposalId: string,
  action: string,
  message: "proposalSent" | "proposalAccepted" | "proposalRejected"
): Promise<ActivityRecord | null> {
  const row = await database.query.proposals.findFirst({
    where: eq(proposals.id, proposalId),
    columns: { number: true }
  })

  if (!row) return null

  return {
    entityType: "proposal",
    entityId: proposalId,
    action,
    messageKey: `activity.messages.${message}`,
    messageArgs: { number: row.number }
  }
}

async function buildContractSigned(contractId: string): Promise<ActivityRecord | null> {
  const row = await database.query.contracts.findFirst({
    where: eq(contracts.id, contractId),
    columns: { title: true }
  })

  if (!row) return null

  return {
    entityType: "contract",
    entityId: contractId,
    action: "signed",
    messageKey: "activity.messages.contractSigned",
    messageArgs: { title: row.title }
  }
}

async function buildInvoiceActivity(
  invoiceId: string,
  action: string,
  message: "invoiceSent" | "invoicePaid"
): Promise<ActivityRecord | null> {
  const number = await findInvoiceNumber(invoiceId)

  if (number === null) return null

  return {
    entityType: "invoice",
    entityId: invoiceId,
    action,
    messageKey: `activity.messages.${message}`,
    messageArgs: { number }
  }
}

async function buildInvoiceOverdue(
  invoiceId: string,
  daysOverdue: number
): Promise<ActivityRecord | null> {
  const number = await findInvoiceNumber(invoiceId)

  if (number === null) return null

  return {
    entityType: "invoice",
    entityId: invoiceId,
    action: "overdue",
    messageKey: "activity.messages.invoiceOverdue",
    messageArgs: { number, days: daysOverdue }
  }
}

// The amount is left out of the message for the same reason `paymentReceived` leaves it out: the
// feed carries no currency, and a bare number beside an invoice in another currency reads as the
// wrong amount. The invoice itself states what was charged.
async function buildInvoiceLateFeeApplied(invoiceId: string): Promise<ActivityRecord | null> {
  const number = await findInvoiceNumber(invoiceId)

  if (number === null) return null

  return {
    entityType: "invoice",
    entityId: invoiceId,
    action: "late_fee_applied",
    messageKey: "activity.messages.invoiceLateFeeApplied",
    messageArgs: { number }
  }
}

async function buildInvoiceGenerated(
  invoiceId: string,
  occurrence: number
): Promise<ActivityRecord | null> {
  const number = await findInvoiceNumber(invoiceId)

  if (number === null) return null

  return {
    entityType: "invoice",
    entityId: invoiceId,
    action: "generated",
    messageKey: "activity.messages.invoiceGenerated",
    messageArgs: { number, occurrence }
  }
}

async function buildRetainerPoolExhausted(
  recurringInvoiceId: string,
  includedHours: number,
  consumedHours: number
): Promise<ActivityRecord | null> {
  const row = await database.query.recurringInvoices.findFirst({
    where: eq(recurringInvoices.id, recurringInvoiceId),
    columns: { name: true }
  })

  if (!row) return null

  return {
    entityType: "recurring_invoice",
    entityId: recurringInvoiceId,
    action: "pool_exhausted",
    messageKey: "activity.messages.retainerPoolExhausted",
    messageArgs: { name: row.name, includedHours, consumedHours }
  }
}

// Carries the two document numbers and no amount, for the reason `invoiceLateFeeApplied` carries
// none: the feed shows no currency, and a credit note priced in its invoice's currency would read as
// the wrong figure beside a row from a client billed in another.
async function buildCreditNoteIssued(
  creditNoteId: string,
  invoiceId: string
): Promise<ActivityRecord | null> {
  const [creditNote, invoiceNumber] = await Promise.all([
    database.query.creditNotes.findFirst({
      where: eq(creditNotes.id, creditNoteId),
      columns: { number: true }
    }),
    findInvoiceNumber(invoiceId)
  ])

  if (!creditNote || invoiceNumber === null) return null

  return {
    entityType: "credit_note",
    entityId: creditNoteId,
    action: "issued",
    messageKey: "activity.messages.creditNoteIssued",
    messageArgs: { number: creditNote.number, invoiceNumber }
  }
}

// Filed under the payment rather than the invoice it settles, so the invoice's own timeline is not
// buried by a part-payment schedule and the entry can link back to the row that was recorded.
async function buildPaymentReceived(
  paymentId: string,
  invoiceId: string
): Promise<ActivityRecord | null> {
  const [payment, number] = await Promise.all([
    database.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      columns: { id: true }
    }),
    findInvoiceNumber(invoiceId)
  ])

  if (!payment || number === null) return null

  return {
    entityType: "payment",
    entityId: paymentId,
    action: "received",
    messageKey: "activity.messages.paymentReceived",
    messageArgs: { number }
  }
}

async function buildTimeLogged(
  timeEntryId: string,
  projectId: string,
  durationSeconds: number
): Promise<ActivityRecord | null> {
  const [entry, project] = await Promise.all([
    database.query.timeEntries.findFirst({
      where: eq(timeEntries.id, timeEntryId),
      columns: { id: true }
    }),
    findProjectName(projectId)
  ])

  if (!entry || project === null) return null

  // Rounded to one decimal here rather than in the message, because ICU can cap the fraction digits
  // it prints but cannot round the stored value, and the feed must not imply a precision the entry
  // does not have.
  const hours = Math.round((durationSeconds / SECONDS_PER_HOUR) * 10) / 10

  return {
    entityType: "time_entry",
    entityId: timeEntryId,
    action: "logged",
    messageKey: "activity.messages.timeLogged",
    messageArgs: { hours, project }
  }
}

async function buildExpenseCreated(expenseId: string): Promise<ActivityRecord | null> {
  const row = await database.query.expenses.findFirst({
    where: eq(expenses.id, expenseId),
    columns: { category: true }
  })

  if (!row) return null

  return {
    entityType: "expense",
    entityId: expenseId,
    action: "created",
    messageKey: "activity.messages.expenseCreated",
    messageArgs: { category: row.category }
  }
}

async function findProjectName(projectId: string): Promise<string | null> {
  const row = await database.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { name: true }
  })

  return row?.name ?? null
}

async function findInvoiceNumber(invoiceId: string): Promise<string | null> {
  const row = await database.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    columns: { number: true }
  })

  return row?.number ?? null
}
