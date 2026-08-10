import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
  makeActivityLog,
  makeClient,
  makeCreditNote,
  makeExpense,
  makeInvoice,
  makePayment,
  makeSettings
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

    const data = await getDashboardPageData({})

    expect(data.revenue.monthToDateCents).toBe(40_000)
    expect(data.revenue.yearToDateCents).toBe(40_000)
  })

  test("separates revenue banked earlier this year from this month", async () => {
    const invoice = await makeInvoice({ status: "sent", totalCents: 100_000 })

    await makePayment({
      invoiceId: invoice.id,
      amountCents: 12_000,
      paidAt: new Date("2026-03-09T00:00:00.000Z")
    })

    const data = await getDashboardPageData({})

    expect(data.revenue.monthToDateCents).toBe(0)
    expect(data.revenue.yearToDateCents).toBe(12_000)
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

    expect(monthData.expenses.periodCents).toBe(5000)
    expect(yearData.expenses.periodCents).toBe(14_000)
  })

  test("estimates profit as period revenue minus period expenses", async () => {
    const invoice = await makeInvoice({ status: "sent", totalCents: 100_000 })

    await makePayment({
      invoiceId: invoice.id,
      amountCents: 30_000,
      paidAt: new Date("2026-08-02T00:00:00.000Z")
    })
    await makeExpense({ amountCents: 4000, spentAt: new Date("2026-08-03T00:00:00.000Z") })

    const data = await getDashboardPageData({ period: "month" })

    expect(data.profitEstimateCents).toBe(26_000)
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
})
