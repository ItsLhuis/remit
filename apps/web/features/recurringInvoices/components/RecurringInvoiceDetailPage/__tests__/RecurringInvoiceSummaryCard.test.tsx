import { cleanup, render, screen } from "@testing-library/react"

import { afterEach, expect, test, vi } from "vitest"

import { type RecurringInvoiceDetail } from "../../../types"
import { RecurringInvoiceSummaryCard } from "../RecurringInvoiceSummaryCard"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

const schedule: RecurringInvoiceDetail = {
  id: "00000000-0000-4000-8000-000000000a01",
  name: "Monthly retainer",
  clientId: "00000000-0000-4000-8000-000000000a02",
  clientName: "Northwind Traders",
  projectId: null,
  projectName: null,
  templateId: null,
  status: "active",
  cadence: "monthly",
  cadenceDay: 15,
  nextRunAt: new Date("2026-11-15T00:00:00.000Z"),
  lastRunAt: null,
  endAfterCount: null,
  endByDate: null,
  occurrencesGenerated: 3,
  autoSend: true,
  currency: "EUR",
  includedHours: null,
  overageRateCents: null,
  notes: "",
  lineItems: [],
  invoices: []
}

afterEach(() => {
  cleanup()
})

test("names every summary value by the label beside it", () => {
  render(<RecurringInvoiceSummaryCard schedule={schedule} locale="en" timeZone="UTC" />)

  expect(
    screen.getByRole("definition", { name: "recurringInvoices.fields.client" })
  ).toHaveTextContent("Northwind Traders")
  expect(
    screen.getByRole("definition", { name: "recurringInvoices.fields.cadenceDay" })
  ).toHaveTextContent("15")
  expect(
    screen.getByRole("definition", { name: "recurringInvoices.fields.currency" })
  ).toHaveTextContent("EUR")
})
