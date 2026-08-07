import { desc } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { emit } from "@/lib/events"

import { activityLogs } from "@/database/schema"

import {
  makeClient,
  makeContract,
  makeExpense,
  makeInvoice,
  makePayment,
  makeProject,
  makeProposal,
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
})
