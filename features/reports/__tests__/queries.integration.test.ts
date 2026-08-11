import { describe, expect, test } from "vitest"

import {
  makeClient,
  makeCreditNote,
  makeExpense,
  makeInvoice,
  makeLineItem,
  makeProject,
  makeTaxRate,
  makeTimeEntry
} from "@/tests/factories"

import { getReportsPageData } from "../queries"
import { getCellValue, type ReportCurrencyGroup } from "../services"

const DEFAULTS = { defaultCurrency: "EUR", defaultLocale: "en", defaultTimezone: "UTC" }

function getTotal(group: ReportCurrencyGroup | undefined, index: number): number {
  const cell = group?.totals[index]

  return cell ? getCellValue(cell) : 0
}

function findGroup(
  groups: ReportCurrencyGroup[],
  currency: string
): ReportCurrencyGroup | undefined {
  return groups.find((group) => group.currency === currency)
}

async function makeIssuedInvoice(overrides: Parameters<typeof makeInvoice>[0] = {}) {
  return makeInvoice({
    status: "sent",
    issueDate: new Date("2026-03-15T00:00:00.000Z"),
    ...overrides
  })
}

describe("getReportsPageData: revenue", () => {
  test("nets credit notes out of revenue while leaving the invoiced value intact", async () => {
    const client = await makeClient({ name: "Aurora" })
    const invoice = await makeIssuedInvoice({ clientId: client.id, totalCents: 100_000 })

    await makeCreditNote({ invoiceId: invoice.id, totalCents: 25_000, currency: "EUR" })

    const data = await getReportsPageData({ report: "revenueByClient" })
    const group = findGroup(data.result.groups, "EUR")

    expect(getTotal(group, 1)).toBe(100_000)
    expect(getTotal(group, 2)).toBe(25_000)
    expect(getTotal(group, 3)).toBe(75_000)
  })

  test("leaves a draft invoice out of the report entirely", async () => {
    await makeInvoice({ status: "draft", totalCents: 100_000 })

    const data = await getReportsPageData({ report: "revenueByClient" })

    expect(data.result.groups).toEqual([])
  })

  test("groups two currencies into two totals rather than adding them", async () => {
    await makeIssuedInvoice({ totalCents: 100_000, currency: "EUR" })
    await makeIssuedInvoice({ totalCents: 40_000, currency: "USD" })

    const data = await getReportsPageData({ report: "revenueByClient" })

    expect(data.result.groups).toHaveLength(2)
    expect(getTotal(findGroup(data.result.groups, "EUR"), 1)).toBe(100_000)
    expect(getTotal(findGroup(data.result.groups, "USD"), 1)).toBe(40_000)
  })

  test("narrows the population to the requested date range", async () => {
    await makeIssuedInvoice({
      totalCents: 100_000,
      issueDate: new Date("2026-03-15T00:00:00.000Z")
    })
    await makeIssuedInvoice({ totalCents: 70_000, issueDate: new Date("2026-05-02T00:00:00.000Z") })

    const data = await getReportsPageData({
      report: "revenueByClient",
      from: "2026-03-01",
      to: "2026-03-31"
    })

    expect(getTotal(findGroup(data.result.groups, "EUR"), 1)).toBe(100_000)
  })

  test("includes an invoice issued on the last day of the range", async () => {
    await makeIssuedInvoice({ totalCents: 55_000, issueDate: new Date("2026-03-31T00:00:00.000Z") })

    const data = await getReportsPageData({
      report: "revenueByClient",
      from: "2026-03-01",
      to: "2026-03-31"
    })

    expect(getTotal(findGroup(data.result.groups, "EUR"), 1)).toBe(55_000)
  })

  test("keeps only the requested client", async () => {
    const wanted = await makeClient({ name: "Aurora" })

    await makeIssuedInvoice({ clientId: wanted.id, totalCents: 100_000 })
    await makeIssuedInvoice({ totalCents: 70_000 })

    const data = await getReportsPageData({ report: "revenueByClient", client: wanted.id })

    expect(data.result.groups[0]?.rows).toHaveLength(1)
    expect(getTotal(findGroup(data.result.groups, "EUR"), 1)).toBe(100_000)
  })

  test("buckets revenue by the month the invoice was issued in", async () => {
    await makeIssuedInvoice({
      totalCents: 100_000,
      issueDate: new Date("2026-01-15T00:00:00.000Z")
    })
    await makeIssuedInvoice({ totalCents: 40_000, issueDate: new Date("2026-03-02T00:00:00.000Z") })

    const data = await getReportsPageData({ report: "revenueByMonth" })

    expect(findGroup(data.result.groups, "EUR")?.rows.map((row) => row.key)).toEqual([
      "2026-01",
      "2026-03"
    ])
  })
})

describe("getReportsPageData: tax summary", () => {
  test("reconciles to the invoice's own tax and total columns to the cent", async () => {
    const standard = await makeTaxRate({ name: "Standard", percentage: "23" })
    const reduced = await makeTaxRate({ name: "Reduced", percentage: "10" })

    const invoice = await makeIssuedInvoice({
      subtotalCents: 150_000,
      taxAmountCents: 28_000,
      totalCents: 178_000
    })

    await makeLineItem({
      invoiceId: invoice.id,
      proposalId: null,
      position: 0,
      taxRateId: standard.id,
      taxPercentageSnapshot: "23",
      subtotalCents: 100_000,
      taxAmountCents: 23_000,
      totalCents: 123_000
    })
    await makeLineItem({
      invoiceId: invoice.id,
      proposalId: null,
      position: 1,
      taxRateId: reduced.id,
      taxPercentageSnapshot: "10",
      subtotalCents: 50_000,
      taxAmountCents: 5_000,
      totalCents: 55_000
    })

    const data = await getReportsPageData({ report: "taxSummary" })
    const group = findGroup(data.result.groups, "EUR")

    expect(getTotal(group, 1)).toBe(invoice.taxAmountCents)
    expect(getTotal(group, 0) + getTotal(group, 1)).toBe(invoice.totalCents)
  })

  test("subtracts a credit note's tax from the rate it was raised at", async () => {
    const standard = await makeTaxRate({ name: "Standard", percentage: "23" })
    const invoice = await makeIssuedInvoice({ totalCents: 123_000, taxAmountCents: 23_000 })

    await makeLineItem({
      invoiceId: invoice.id,
      proposalId: null,
      position: 0,
      taxRateId: standard.id,
      taxPercentageSnapshot: "23",
      subtotalCents: 100_000,
      taxAmountCents: 23_000,
      totalCents: 123_000
    })

    const creditNote = await makeCreditNote({
      invoiceId: invoice.id,
      currency: "EUR",
      totalCents: 12_300,
      taxAmountCents: 2_300
    })

    await makeLineItem({
      creditNoteId: creditNote.id,
      proposalId: null,
      position: 0,
      taxRateId: standard.id,
      taxPercentageSnapshot: "23",
      subtotalCents: 10_000,
      taxAmountCents: 2_300,
      totalCents: 12_300
    })

    const group = findGroup(
      (await getReportsPageData({ report: "taxSummary" })).result.groups,
      "EUR"
    )

    expect(getTotal(group, 3)).toBe(2_300)
    expect(getTotal(group, 4)).toBe(20_700)
  })
})

describe("getReportsPageData: time and expenses", () => {
  test("splits a project's hours by whether they are billable", async () => {
    const project = await makeProject({ name: "Rebuild", currency: "EUR" })

    await makeTimeEntry({
      projectId: project.id,
      billable: true,
      durationSeconds: 3600,
      hourlyRateSnapshotCents: 10_000,
      startedAt: new Date("2026-03-10T09:00:00.000Z")
    })
    await makeTimeEntry({
      projectId: project.id,
      billable: false,
      durationSeconds: 1800,
      hourlyRateSnapshotCents: 10_000,
      startedAt: new Date("2026-03-11T09:00:00.000Z")
    })

    const data = await getReportsPageData({ report: "timeByProject" })
    const group = findGroup(data.result.groups, "EUR")

    expect(group?.rows).toHaveLength(2)
    expect(getTotal(group, 1)).toBe(5400)
    expect(getTotal(group, 2)).toBe(15_000)
  })

  test("prices a project with no currency of its own in the instance default", async () => {
    const client = await makeClient({ currency: null })
    const project = await makeProject({ clientId: client.id, currency: null })

    await makeTimeEntry({
      projectId: project.id,
      durationSeconds: 3600,
      hourlyRateSnapshotCents: 10_000,
      startedAt: new Date("2026-03-10T09:00:00.000Z")
    })

    const data = await getReportsPageData({ report: "timeByProject" })

    expect(data.result.groups[0]?.currency).toBe(DEFAULTS.defaultCurrency)
  })

  test("totals expenses per category and carries the markup into the rebillable column", async () => {
    await makeExpense({
      category: "travel",
      amountCents: 10_000,
      currency: "EUR",
      rebillable: true,
      markupPercentage: "10",
      spentAt: new Date("2026-03-04T00:00:00.000Z")
    })
    await makeExpense({
      category: "travel",
      amountCents: 5_000,
      currency: "EUR",
      spentAt: new Date("2026-03-05T00:00:00.000Z")
    })

    const data = await getReportsPageData({ report: "expensesByCategory" })
    const group = findGroup(data.result.groups, "EUR")

    expect(group?.rows).toHaveLength(1)
    expect(getTotal(group, 1)).toBe(15_000)
    expect(getTotal(group, 2)).toBe(11_000)
  })
})
