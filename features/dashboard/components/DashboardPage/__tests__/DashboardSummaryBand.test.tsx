import { cleanup, render, screen } from "@testing-library/react"

import { afterEach, expect, test } from "vitest"

import { type DashboardPageData } from "../../../types"
import { DashboardSummaryBand } from "../DashboardSummaryBand"

function makeData(overrides: Partial<DashboardPageData> = {}): DashboardPageData {
  return {
    query: { period: "year" },
    currency: "EUR",
    otherCurrencyCount: 0,
    revenue: { monthToDateCents: 0, yearToDateCents: 0, periodCents: 0 },
    receivables: {
      outstandingCents: 0,
      outstandingCount: 0,
      overdueCents: 0,
      overdueCount: 0
    },
    expenses: { periodCents: 0, count: 0 },
    profitEstimateCents: 0,
    cashflow: [],
    upcomingInvoices: [],
    topClients: [],
    activity: [],
    defaults: { defaultCurrency: "EUR", defaultLocale: "en", defaultTimezone: "UTC" },
    ...overrides
  }
}

afterEach(cleanup)

test("offers a next step on every empty tile that has one", () => {
  render(<DashboardSummaryBand data={makeData()} />)

  expect(screen.getByText("dashboard.tiles.revenueEmptyHint")).toBeInTheDocument()
  expect(screen.getByText("dashboard.tiles.outstandingEmptyHint")).toBeInTheDocument()
  expect(screen.getByText("dashboard.tiles.expensesEmptyHint")).toBeInTheDocument()
  expect(
    screen.getAllByRole("link", { name: /dashboard.tiles.(revenue|outstanding)Action/ })
  ).toHaveLength(2)
  expect(screen.getByRole("link", { name: "dashboard.tiles.expensesAction" })).toHaveAttribute(
    "href",
    "/expenses"
  )
})

test("offers no next step when an empty tile is good news", () => {
  render(<DashboardSummaryBand data={makeData()} />)

  expect(screen.getByText("dashboard.tiles.overdueEmptyHint")).toBeInTheDocument()
  expect(screen.getAllByRole("link")).toHaveLength(3)
})

test("shows the figures and drops the next steps once money has been recorded", () => {
  const data = makeData({
    revenue: { monthToDateCents: 120_000, yearToDateCents: 450_000, periodCents: 450_000 },
    receivables: {
      outstandingCents: 80_000,
      outstandingCount: 2,
      overdueCents: 0,
      overdueCount: 0
    },
    expenses: { periodCents: 15_000, count: 3 },
    profitEstimateCents: 435_000
  })

  render(<DashboardSummaryBand data={data} />)

  expect(screen.getByTitle("€1,200.00")).toBeInTheDocument()
  expect(screen.getByTitle("€800.00")).toBeInTheDocument()
  expect(screen.queryAllByRole("link")).toHaveLength(0)
})

test("says which currency the figures are in when the instance holds several", () => {
  render(<DashboardSummaryBand data={makeData({ otherCurrencyCount: 2 })} />)

  expect(screen.getByText("dashboard.currencyNote")).toBeInTheDocument()
})

test("says nothing about currency when the instance holds only one", () => {
  render(<DashboardSummaryBand data={makeData()} />)

  expect(screen.queryByText("dashboard.currencyNote")).not.toBeInTheDocument()
})
