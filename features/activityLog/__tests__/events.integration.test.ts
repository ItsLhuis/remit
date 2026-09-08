import { desc } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { emit } from "@/lib/events"

import { activityLogs } from "@/database/schema"

import {
  makeClient,
  makeContract,
  makeCreditNote,
  makeExpense,
  makeInvoice,
  makeLead,
  makePayment,
  makeProject,
  makeProposal,
  makeRecurringInvoice,
  makeTimeEntry
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

// Imported for its side effect, exactly as `instrumentation.ts` and `scripts/worker.ts` do it: the
// subscriptions register at module load, so nothing here wires a handler by hand and the test
// exercises the same registration path production uses.
import "../events"

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn()
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

async function listRows() {
  return database.select().from(activityLogs).orderBy(desc(activityLogs.createdAt))
}

beforeEach(() => {
  mocks.loggerError.mockClear()
})

describe("activity log subscriptions", () => {
  test("writes a client row when a client is created", async () => {
    const client = await makeClient({ name: "Acme Industries" })

    await emit("client.created", { clientId: client.id, userId: "user-1" })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "client",
      entityId: client.id,
      action: "created",
      messageKey: "activity.messages.clientCreated",
      messageArgs: { name: "Acme Industries" },
      readAt: null
    })
  })

  test("carries the raw status when a project changes status", async () => {
    const project = await makeProject({ name: "Rebrand" })

    await emit("project.status_changed", {
      projectId: project.id,
      userId: "user-1",
      from: "active",
      to: "on_hold"
    })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "project",
      action: "status_changed",
      messageKey: "activity.messages.projectStatusChanged",
      messageArgs: { name: "Rebrand", status: "on_hold" }
    })
  })

  test("writes a proposal row carrying the proposal number when one is accepted", async () => {
    const proposal = await makeProposal()

    await emit("proposal.accepted", { proposalId: proposal.id, projectId: proposal.projectId })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "proposal",
      entityId: proposal.id,
      action: "accepted",
      messageKey: "activity.messages.proposalAccepted",
      messageArgs: { number: proposal.number }
    })
  })

  test("writes a contract row carrying the contract title when one is signed", async () => {
    const contract = await makeContract({ title: "Retainer agreement" })

    await emit("contract.signed", { contractId: contract.id, signatureId: crypto.randomUUID() })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "contract",
      action: "signed",
      messageKey: "activity.messages.contractSigned",
      messageArgs: { title: "Retainer agreement" }
    })
  })

  test("writes an invoice row when an invoice is marked paid", async () => {
    const invoice = await makeInvoice()

    await emit("invoice.paid", { invoiceId: invoice.id, userId: null })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "invoice",
      entityId: invoice.id,
      action: "paid",
      messageKey: "activity.messages.invoicePaid",
      messageArgs: { number: invoice.number }
    })
  })

  test("carries the overdue day count when the sweep announces a crossing", async () => {
    const invoice = await makeInvoice()

    await emit("invoice.overdue", {
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      daysOverdue: 12
    })

    const [row] = await listRows()

    expect(row).toMatchObject({
      action: "overdue",
      messageKey: "activity.messages.invoiceOverdue",
      messageArgs: { number: invoice.number, days: 12 }
    })
  })

  test("files a generated invoice under the invoice it produced", async () => {
    const invoice = await makeInvoice()

    await emit("recurring.invoice_generated", {
      recurringInvoiceId: crypto.randomUUID(),
      invoiceId: invoice.id,
      clientId: crypto.randomUUID(),
      projectId: null,
      occurrence: 4
    })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "invoice",
      entityId: invoice.id,
      action: "generated",
      messageKey: "activity.messages.invoiceGenerated",
      messageArgs: { number: invoice.number, occurrence: 4 }
    })
  })

  test("files a received payment under the payment rather than the invoice", async () => {
    const invoice = await makeInvoice()
    const payment = await makePayment({ invoiceId: invoice.id })

    await emit("payment.received", { paymentId: payment.id, invoiceId: invoice.id, userId: null })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "payment",
      entityId: payment.id,
      action: "received",
      messageKey: "activity.messages.paymentReceived",
      messageArgs: { number: invoice.number }
    })
  })

  test("rounds logged time to one decimal hour", async () => {
    const project = await makeProject({ name: "Rebrand" })
    const timeEntry = await makeTimeEntry({ projectId: project.id })

    await emit("time.logged", {
      timeEntryId: timeEntry.id,
      projectId: project.id,
      taskId: null,
      userId: "user-1",
      durationSeconds: 5400,
      billable: true
    })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "time_entry",
      entityId: timeEntry.id,
      action: "logged",
      messageKey: "activity.messages.timeLogged",
      messageArgs: { hours: 1.5, project: "Rebrand" }
    })
  })

  test("writes an expense row carrying the category when an expense is recorded", async () => {
    const expense = await makeExpense({ category: "software" })

    await emit("expense.created", {
      expenseId: expense.id,
      projectId: null,
      clientId: null,
      userId: "user-1",
      rebillable: false
    })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "expense",
      action: "created",
      messageKey: "activity.messages.expenseCreated",
      messageArgs: { category: "software" }
    })
  })

  test("writes a lead row naming the lead when a lead becomes a client", async () => {
    const lead = await makeLead({ firstName: "Mara", lastName: "Vance" })

    await emit("lead.converted", {
      leadId: lead.id,
      userId: "user-1",
      clientId: crypto.randomUUID()
    })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "lead",
      entityId: lead.id,
      action: "converted",
      messageKey: "activity.messages.leadConverted",
      messageArgs: { name: "Mara Vance" }
    })
  })

  test("falls back to the company when a converted lead has no person name", async () => {
    const lead = await makeLead({ firstName: null, lastName: null, company: "Northwind Ltd" })

    await emit("lead.converted", {
      leadId: lead.id,
      userId: "user-1",
      clientId: crypto.randomUUID()
    })

    const [row] = await listRows()

    expect(row?.messageArgs).toEqual({ name: "Northwind Ltd" })
  })

  test("names both documents when a credit note is issued", async () => {
    const invoice = await makeInvoice({ status: "sent" })
    const creditNote = await makeCreditNote({ invoiceId: invoice.id, number: "CN-0007" })

    await emit("credit_note.issued", {
      creditNoteId: creditNote.id,
      invoiceId: invoice.id,
      userId: "user-1"
    })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "credit_note",
      entityId: creditNote.id,
      action: "issued",
      messageKey: "activity.messages.creditNoteIssued",
      messageArgs: { number: "CN-0007", invoiceNumber: invoice.number }
    })
  })

  test("files an exhausted retainer under the schedule that ran out", async () => {
    const schedule = await makeRecurringInvoice({ name: "Support retainer" })

    await emit("retainer.pool_exhausted", {
      recurringInvoiceId: schedule.id,
      clientId: schedule.clientId,
      includedHours: 10,
      consumedHours: 13.5
    })

    const [row] = await listRows()

    expect(row).toMatchObject({
      entityType: "recurring_invoice",
      entityId: schedule.id,
      action: "pool_exhausted",
      messageKey: "activity.messages.retainerPoolExhausted",
      messageArgs: { name: "Support retainer", includedHours: 10, consumedHours: 13.5 }
    })
  })

  // A generated run announces the invoice and nothing else. The schedule earns a row only when its
  // pool runs out, which is a fact the invoice does not carry — so a run that exhausts its retainer
  // writes two rows about two different things, and an ordinary run writes exactly one.
  test("writes one row for a generated run that does not exhaust its retainer", async () => {
    const invoice = await makeInvoice()
    const schedule = await makeRecurringInvoice()

    await emit("recurring.invoice_generated", {
      recurringInvoiceId: schedule.id,
      invoiceId: invoice.id,
      clientId: schedule.clientId,
      projectId: null,
      occurrence: 2
    })

    const rows = await listRows()

    expect(rows).toHaveLength(1)
    expect(rows[0]?.entityType).toBe("invoice")
  })

  // The column stores ICU arguments so a row re-renders in whatever locale reads it. A number that
  // arrived here already formatted would freeze one locale's separators and currency into history,
  // and nothing downstream could tell it apart from a name.
  test("stores no locale-formatted value in any message argument", async () => {
    const lead = await makeLead({ firstName: "Mara", lastName: "Vance" })
    const invoice = await makeInvoice({ status: "sent" })
    const creditNote = await makeCreditNote({ invoiceId: invoice.id })
    const schedule = await makeRecurringInvoice({ name: "Support retainer" })

    await emit("lead.converted", {
      leadId: lead.id,
      userId: "user-1",
      clientId: crypto.randomUUID()
    })
    await emit("credit_note.issued", {
      creditNoteId: creditNote.id,
      invoiceId: invoice.id,
      userId: "user-1"
    })
    await emit("retainer.pool_exhausted", {
      recurringInvoiceId: schedule.id,
      clientId: schedule.clientId,
      includedHours: 10,
      consumedHours: 13.5
    })

    const values = (await listRows()).flatMap((row) => Object.values(row.messageArgs ?? {}))

    expect(values).not.toHaveLength(0)

    for (const value of values) {
      expect(["string", "number"]).toContain(typeof value)

      if (typeof value === "string") {
        expect(value).not.toMatch(/[€$£¥]|\d[.,]\d{3}\b|\d+[.,]\d{2}\s*[A-Z]{3}/)
      }
    }
  })

  test("writes nothing when the record the event names no longer exists", async () => {
    await emit("invoice.paid", { invoiceId: crypto.randomUUID(), userId: null })

    expect(await listRows()).toHaveLength(0)
    expect(mocks.loggerError).not.toHaveBeenCalled()
  })

  test("resolves rather than rejecting when the write fails", async () => {
    await expect(
      emit("client.created", { clientId: "not-a-uuid", userId: "user-1" })
    ).resolves.toBeUndefined()

    expect(await listRows()).toHaveLength(0)
    expect(mocks.loggerError).toHaveBeenCalledOnce()
  })

  // `lib/events/bus.ts` catches nothing, so a handler that let this escape would fail the mutation
  // that issued the credit note for the sake of a history row.
  test("does not break the emitting action when a new handler fails", async () => {
    await expect(
      emit("credit_note.issued", {
        creditNoteId: "not-a-uuid",
        invoiceId: crypto.randomUUID(),
        userId: "user-1"
      })
    ).resolves.toBeUndefined()

    expect(await listRows()).toHaveLength(0)
    expect(mocks.loggerError).toHaveBeenCalledOnce()
  })
})
