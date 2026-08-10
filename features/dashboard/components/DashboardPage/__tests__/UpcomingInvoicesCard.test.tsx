import { cleanup, render, screen } from "@testing-library/react"

import { afterEach, expect, test } from "vitest"

import { type UpcomingInvoice } from "../../../services"
import { UpcomingInvoicesCard } from "../UpcomingInvoicesCard"

function makeInvoice(overrides: Partial<UpcomingInvoice> = {}): UpcomingInvoice {
  return {
    id: "invoice-1",
    number: "INV-0001",
    parentName: "Acme",
    currency: "EUR",
    dueDate: new Date("2026-08-20T00:00:00.000Z"),
    receivableCents: 50_000,
    daysUntilDue: 10,
    ...overrides
  }
}

afterEach(cleanup)

test("points at the invoices page when nothing is due", () => {
  render(<UpcomingInvoicesCard invoices={[]} locale="en" />)

  expect(screen.getByText("dashboard.upcoming.emptyTitle")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "dashboard.upcoming.emptyAction" })).toHaveAttribute(
    "href",
    "/invoices"
  )
})

test("lists each invoice with what is still owed on it", () => {
  render(<UpcomingInvoicesCard invoices={[makeInvoice()]} locale="en" />)

  expect(screen.getByText("INV-0001")).toBeInTheDocument()
  expect(screen.getByText("Acme")).toBeInTheDocument()
  expect(screen.getByText("€500.00")).toBeInTheDocument()
})

test("names today rather than counting zero days when an invoice is due today", () => {
  render(<UpcomingInvoicesCard invoices={[makeInvoice({ daysUntilDue: 0 })]} locale="en" />)

  expect(screen.getByText("dashboard.upcoming.dueToday")).toBeInTheDocument()
  expect(screen.queryByText("dashboard.upcoming.dueIn")).not.toBeInTheDocument()
})

test("falls back to a placeholder when the invoice has no client to name", () => {
  render(<UpcomingInvoicesCard invoices={[makeInvoice({ parentName: "" })]} locale="en" />)

  expect(screen.getByText("dashboard.upcoming.noParent")).toBeInTheDocument()
})
