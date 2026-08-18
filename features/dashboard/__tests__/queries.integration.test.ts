import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
  makeActivityLog,
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
  makeSettings,
  makeTask,
  makeTimeEntry
} from "@/tests/factories"

import { getDashboardPageData } from "../queries"

const NOW = new Date("2026-08-10T12:00:00.000Z")

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("getDashboardPageData", () => {
  test("reports revenue from payments rather than from invoice totals", async () => {
    const invoice = await makeInvoice({ status: "sent", totalCents: 100_000, currency: "EUR" })

    await makePayment({
      invoiceId: invoice.id,
      amountCents: 40_000,
      currency: "EUR",
      paidAt: new Date("2026-08-02T00:00:00.000Z")
    })

    const monthData = await getDashboardPageData({ period: "month" })
    const yearData = await getDashboardPageData({ period: "year" })

    expect(monthData.metrics.revenue.delta.currentCents).toBe(40_000)
    expect(yearData.metrics.revenue.delta.currentCents).toBe(40_000)
  })

  test("separates revenue banked earlier this year from this month", async () => {
    const invoice = await makeInvoice({ status: "sent", totalCents: 100_000 })

    await makePayment({
      invoiceId: invoice.id,
      amountCents: 12_000,
      paidAt: new Date("2026-03-09T00:00:00.000Z")
    })

    const monthData = await getDashboardPageData({ period: "month" })
    const yearData = await getDashboardPageData({ period: "year" })

    expect(monthData.metrics.revenue.delta.currentCents).toBe(0)
    expect(yearData.metrics.revenue.delta.currentCents).toBe(12_000)
  })

  test("nets credit notes out of the outstanding receivable", async () => {
    const invoice = await makeInvoice({ status: "sent", totalCents: 100_000, currency: "EUR" })

    await makeCreditNote({ invoiceId: invoice.id, currency: "EUR", totalCents: 30_000 })

    const data = await getDashboardPageData({})

    expect(data.receivables.outstandingCents).toBe(70_000)
    expect(data.receivables.outstandingCount).toBe(1)
  })

  test("drops an invoice fully cancelled by a credit note from the outstanding count", async () => {
    const invoice = await makeInvoice({ status: "sent", totalCents: 50_000, currency: "EUR" })

    await makeCreditNote({ invoiceId: invoice.id, currency: "EUR", totalCents: 50_000 })

    const data = await getDashboardPageData({})

    expect(data.receivables.outstandingCents).toBe(0)
    expect(data.receivables.outstandingCount).toBe(0)
  })

  test("excludes draft and paid invoices from what is outstanding", async () => {
    await makeInvoice({ status: "draft", totalCents: 80_000 })
    await makeInvoice({ status: "paid", totalCents: 90_000, paidAt: NOW })

    const data = await getDashboardPageData({})

    expect(data.receivables.outstandingCount).toBe(0)
  })

  test("counts an invoice past its due date as overdue", async () => {
    await makeInvoice({
      status: "sent",
      totalCents: 25_000,
      dueDate: new Date("2026-08-09T00:00:00.000Z")
    })

    const data = await getDashboardPageData({})

    expect(data.receivables.overdueCents).toBe(25_000)
    expect(data.receivables.overdueCount).toBe(1)
  })

  test("does not treat an invoice due today as overdue", async () => {
    await makeInvoice({
      status: "sent",
      totalCents: 25_000,
      dueDate: new Date("2026-08-10T00:00:00.000Z")
    })

    const data = await getDashboardPageData({})

    expect(data.receivables.overdueCount).toBe(0)
    expect(data.upcomingInvoices).toHaveLength(1)
  })

  test("lists invoices due within the next thirty days and leaves out later ones", async () => {
    await makeInvoice({
      number: "INV-SOON",
      status: "sent",
      totalCents: 10_000,
      dueDate: new Date("2026-09-09T00:00:00.000Z")
    })
    await makeInvoice({
      number: "INV-LATER",
      status: "sent",
      totalCents: 10_000,
      dueDate: new Date("2026-09-10T00:00:00.000Z")
    })

    const data = await getDashboardPageData({})

    expect(data.upcomingInvoices.map((invoice) => invoice.number)).toEqual(["INV-SOON"])
  })

  test("totals expenses for the selected period only", async () => {
    await makeExpense({ amountCents: 5000, spentAt: new Date("2026-08-03T00:00:00.000Z") })
    await makeExpense({ amountCents: 9000, spentAt: new Date("2026-02-03T00:00:00.000Z") })

    const monthData = await getDashboardPageData({ period: "month" })
    const yearData = await getDashboardPageData({ period: "year" })

    expect(monthData.metrics.expenses.delta.currentCents).toBe(5000)
    expect(yearData.metrics.expenses.delta.currentCents).toBe(14_000)
  })

  test("estimates the net position as period revenue minus period expenses", async () => {
    const invoice = await makeInvoice({ status: "sent", totalCents: 100_000 })

    await makePayment({
      invoiceId: invoice.id,
      amountCents: 30_000,
      paidAt: new Date("2026-08-02T00:00:00.000Z")
    })
    await makeExpense({ amountCents: 4000, spentAt: new Date("2026-08-03T00:00:00.000Z") })

    const data = await getDashboardPageData({ period: "month" })

    expect(data.metrics.net.delta.currentCents).toBe(26_000)
  })

  test("builds a twelve-month cashflow series ending with the current month", async () => {
    const invoice = await makeInvoice({ status: "sent", totalCents: 100_000 })

    await makePayment({
      invoiceId: invoice.id,
      amountCents: 7000,
      paidAt: new Date("2026-07-15T00:00:00.000Z")
    })
    await makeExpense({ amountCents: 1500, spentAt: new Date("2026-07-20T00:00:00.000Z") })

    const data = await getDashboardPageData({})

    expect(data.cashflow).toHaveLength(12)
    expect(data.cashflow[11]?.month).toBe("2026-08")
    expect(data.cashflow[10]).toEqual({
      month: "2026-07",
      revenueCents: 7000,
      expenseCents: 1500
    })
  })

  test("ranks clients by the payments recorded against their invoices", async () => {
    const [big, small] = await Promise.all([
      makeClient({ name: "Big" }),
      makeClient({ name: "Small" })
    ])
    const [bigInvoice, smallInvoice] = await Promise.all([
      makeInvoice({ clientId: big.id, status: "sent", totalCents: 100_000 }),
      makeInvoice({ clientId: small.id, status: "sent", totalCents: 100_000 })
    ])

    await makePayment({ invoiceId: bigInvoice.id, amountCents: 75_000, paidAt: NOW })
    await makePayment({ invoiceId: smallInvoice.id, amountCents: 25_000, paidAt: NOW })

    const data = await getDashboardPageData({})

    expect(data.topClients.map((client) => client.name)).toEqual(["Big", "Small"])
    expect(data.topClients[0]?.sharePercentage).toBe(75)
  })

  test("returns the most recent activity entries", async () => {
    await makeActivityLog({ createdAt: new Date("2026-08-01T00:00:00.000Z") })

    const newest = await makeActivityLog({
      entityType: "invoice",
      messageKey: "activity.messages.invoicePaid",
      messageArgs: { number: "INV-1" },
      createdAt: new Date("2026-08-09T00:00:00.000Z")
    })

    const data = await getDashboardPageData({})

    expect(data.activity[0]?.id).toBe(newest.id)
  })

  test("leads with the instance default currency when nothing has been recorded", async () => {
    await makeSettings({ defaultCurrency: "GBP", defaultLocale: "en", defaultTimezone: "UTC" })

    const data = await getDashboardPageData({})

    expect(data.currency).toBe("GBP")
    expect(data.otherCurrencyCount).toBe(0)
    expect(data.receivables.outstandingCount).toBe(0)
    expect(data.upcomingInvoices).toEqual([])
    expect(data.topClients).toEqual([])
  })

  test("leads with the currency carrying the most money and reports the others", async () => {
    await makeSettings({ defaultCurrency: "GBP", defaultLocale: "en", defaultTimezone: "UTC" })
    await makeInvoice({ status: "sent", totalCents: 900_000, currency: "USD" })
    await makeInvoice({ status: "sent", totalCents: 10_000, currency: "EUR" })

    const data = await getDashboardPageData({})

    expect(data.currency).toBe("USD")
    expect(data.otherCurrencyCount).toBe(1)
    expect(data.receivables.outstandingCents).toBe(900_000)
  })

  test("falls back to the default period when the query parameter is not a known one", async () => {
    const data = await getDashboardPageData({ period: "fortnight" })

    expect(data.query.period).toBe("year")
  })

  test("compares the period against the same elapsed slice of the one before it", async () => {
    const invoice = await makeInvoice({ status: "sent", totalCents: 500_000 })

    await makePayment({
      invoiceId: invoice.id,
      amountCents: 20_000,
      paidAt: new Date("2026-08-02T00:00:00.000Z")
    })
    await makePayment({
      invoiceId: invoice.id,
      amountCents: 10_000,
      paidAt: new Date("2026-07-03T00:00:00.000Z")
    })

    const data = await getDashboardPageData({ period: "month" })

    expect(data.metrics.revenue.delta.previousCents).toBe(10_000)
    expect(data.metrics.revenue.delta.direction).toBe("up")
  })

  test("offers no comparison for the all-time period", async () => {
    const data = await getDashboardPageData({ period: "all" })

    expect(data.metrics.revenue.delta.previousCents).toBeNull()
    expect(data.metrics.revenue.delta.direction).toBe("unknown")
  })

  test("ages the outstanding receivable by how far past its due date each invoice is", async () => {
    await makeInvoice({
      status: "sent",
      totalCents: 60_000,
      dueDate: new Date("2026-09-01T00:00:00.000Z")
    })
    await makeInvoice({
      status: "sent",
      totalCents: 40_000,
      dueDate: new Date("2026-07-20T00:00:00.000Z")
    })

    const data = await getDashboardPageData({})

    const notDue = data.aging.buckets.find((bucket) => bucket.id === "notDue")
    const late = data.aging.buckets.find((bucket) => bucket.id === "days1To30")

    expect(notDue?.cents).toBe(60_000)
    expect(late?.cents).toBe(40_000)
    expect(data.aging.oldestDaysLate).toBe(21)
  })

  test("counts an issued invoice the client has never opened", async () => {
    await makeInvoice({ status: "sent", totalCents: 10_000, viewCount: 0 })
    await makeInvoice({ status: "sent", totalCents: 10_000, viewCount: 4 })
    await makeInvoice({ status: "draft", totalCents: 10_000, viewCount: 0 })

    const data = await getDashboardPageData({})

    expect(data.lifecycle.issuedCount).toBe(2)
    expect(data.lifecycle.unviewedCount).toBe(1)
    expect(data.lifecycle.stages.find((stage) => stage.id === "viewed")?.count).toBe(1)
    expect(data.lifecycle.stages.find((stage) => stage.id === "draft")?.count).toBe(1)
  })

  test("values billable time and rebillable expenses that have not reached an invoice", async () => {
    const project = await makeProject({ currency: "EUR" })

    await makeTimeEntry({
      projectId: project.id,
      durationSeconds: 7200,
      hourlyRateSnapshotCents: 9000,
      billable: true
    })
    await makeExpense({ amountCents: 20_000, rebillable: true, markupPercentage: "10.00" })

    const data = await getDashboardPageData({})

    expect(data.unbilled.timeCents).toBe(18_000)
    expect(data.unbilled.expenseCents).toBe(22_000)
    expect(data.unbilled.totalCents).toBe(40_000)
  })

  test("leaves already invoiced work out of what is ready to bill", async () => {
    const project = await makeProject({ currency: "EUR" })
    const invoice = await makeInvoice({ status: "sent", totalCents: 10_000 })

    await makeTimeEntry({ projectId: project.id, billable: true, invoicedInId: invoice.id })
    await makeTimeEntry({ projectId: project.id, billable: false })

    const data = await getDashboardPageData({})

    expect(data.unbilled.timeEntryCount).toBe(0)
  })

  test("ranks an overdue invoice above an unsigned contract in the attention rail", async () => {
    await makeInvoice({
      number: "INV-LATE",
      status: "sent",
      totalCents: 25_000,
      dueDate: new Date("2026-07-01T00:00:00.000Z"),
      viewCount: 1
    })
    await makeContract({ status: "sent", issuedAt: new Date("2026-07-01T00:00:00.000Z") })

    const data = await getDashboardPageData({})

    expect(data.attention[0]?.kind).toBe("invoiceOverdue")
    expect(data.attention.map((item) => item.kind)).toContain("contractUnsigned")
  })

  test("raises a sent proposal that is about to expire", async () => {
    const project = await makeProject()

    await makeProposal({
      projectId: project.id,
      status: "sent",
      validUntil: new Date("2026-08-12T00:00:00.000Z"),
      issuedAt: new Date("2026-08-01T00:00:00.000Z"),
      viewCount: 2
    })

    const data = await getDashboardPageData({})

    expect(data.attention.map((item) => item.kind)).toContain("proposalExpiring")
  })

  test("raises a task due inside the horizon and ignores a completed one", async () => {
    const project = await makeProject({ name: "Website" })

    await makeTask({
      projectId: project.id,
      title: "Ship the report",
      dueAt: new Date("2026-08-11T00:00:00.000Z")
    })
    await makeTask({
      projectId: project.id,
      title: "Already done",
      status: "done",
      dueAt: new Date("2026-08-11T00:00:00.000Z")
    })

    const data = await getDashboardPageData({})

    const dueTasks = data.attention.filter((item) => item.kind === "taskDue")

    expect(dueTasks.map((item) => item.subject)).toEqual(["Ship the report"])
  })

  test("counts leads by the stage they have reached and rates only decided ones", async () => {
    await makeLead({ status: "new" })
    await makeLead({ status: "won" })
    await makeLead({ status: "won" })
    await makeLead({ status: "lost" })

    const data = await getDashboardPageData({})

    expect(data.pipeline.totalCount).toBe(4)
    expect(data.pipeline.openCount).toBe(1)
    expect(data.pipeline.winRatePercentage).toBe(66.7)
  })

  test("lists active recurring schedules and leaves paused ones out", async () => {
    const client = await makeClient({ name: "Acme" })

    await makeRecurringInvoice({
      clientId: client.id,
      name: "Active retainer",
      status: "active",
      nextRunAt: new Date(Date.UTC(2026, 7, 20))
    })
    await makeRecurringInvoice({
      clientId: client.id,
      name: "Paused retainer",
      status: "paused",
      nextRunAt: new Date(Date.UTC(2026, 7, 21))
    })

    const data = await getDashboardPageData({})

    expect(data.schedules.map((schedule) => schedule.name)).toEqual(["Active retainer"])
    expect(data.schedules[0]?.daysUntilRun).toBe(10)
  })

  test("returns designed empty results across every section on a fresh instance", async () => {
    const data = await getDashboardPageData({})

    expect(data.receivables.outstandingCount).toBe(0)
    expect(data.aging.totalCents).toBe(0)
    expect(data.lifecycle.issuedCount).toBe(0)
    expect(data.unbilled.totalCents).toBe(0)
    expect(data.attention).toEqual([])
    expect(data.attentionTotalCount).toBe(0)
    expect(data.pipeline.totalCount).toBe(0)
    expect(data.schedules).toEqual([])
    expect(data.metrics.net.delta.currentCents).toBe(0)
  })
})
