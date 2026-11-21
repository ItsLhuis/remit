import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, expect, test, vi } from "vitest"

import { axe } from "vitest-axe"

import { TooltipProvider } from "@/components/ui"

import { type BillableExpenseRow, type BillableTimeEntryRow } from "../../../services"
import { type BillableTargetInvoice } from "../../../types"
import { BillableWorkSheet } from "../BillableWorkSheet"

const mocks = vi.hoisted(() => ({ convertBillableWork: vi.fn() }))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

vi.mock("../../../billing", () => ({
  convertBillableWork: mocks.convertBillableWork
}))

function makeTimeEntry(overrides: Partial<BillableTimeEntryRow> = {}): BillableTimeEntryRow {
  return {
    id: "entry-1",
    clientId: "client-1",
    projectId: "project-1",
    projectName: "Website rebuild",
    taskId: null,
    taskTitle: null,
    description: "Layout pass",
    durationSeconds: 3600,
    hourlyRateSnapshotCents: 10_000,
    currency: "EUR",
    ...overrides
  }
}

function makeExpense(overrides: Partial<BillableExpenseRow> = {}): BillableExpenseRow {
  return {
    id: "expense-1",
    clientId: "client-1",
    projectId: "project-1",
    description: "Stock photography",
    rebillableCents: 5000,
    descriptionSuffix: null,
    currency: "USD",
    ...overrides
  }
}

function renderSheet(props: {
  timeEntries?: BillableTimeEntryRow[]
  expenses?: BillableExpenseRow[]
  targets?: BillableTargetInvoice[]
}): ReturnType<typeof render> {
  // `SheetContent`'s close control is an `IconButton`, which is a Radix tooltip trigger; the app
  // shell provides the provider these tests have to stand in for.
  return render(
    <TooltipProvider>
      <BillableWorkSheet
        open
        timeEntries={props.timeEntries ?? [makeTimeEntry()]}
        expenses={props.expenses ?? []}
        targets={props.targets ?? []}
        locale="en"
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />
    </TooltipProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Scoped to the dialog rather than the whole document: Radix renders a pair of
// `data-radix-focus-guard` sentinel spans outside the content, and axe's `aria-hidden-focus` rule
// flags them on every portal-rendered surface. They are the primitive's focus trap, not this
// sheet's markup, so auditing them here would test Radix.
test("has no accessibility violations", async () => {
  renderSheet({})

  expect((await axe(screen.getByRole("dialog"))).violations).toEqual([])
})

test("shows what will be billed before anything is submitted", () => {
  renderSheet({})

  expect(screen.getByText("Layout pass")).toBeInTheDocument()
  expect(mocks.convertBillableWork).not.toHaveBeenCalled()
})

test("refuses to submit a selection spanning two currencies", async () => {
  renderSheet({ timeEntries: [makeTimeEntry()], expenses: [makeExpense({ currency: "USD" })] })

  expect(screen.getByText("invoices.billable.previewEmpty")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "invoices.billable.submit" })).toBeDisabled()
})

test("submits the planned selection and surfaces a server refusal in place", async () => {
  const user = userEvent.setup()

  mocks.convertBillableWork.mockResolvedValue({ error: "Nothing in the selection can be billed" })

  renderSheet({})

  await user.click(screen.getByRole("button", { name: "invoices.billable.submit" }))

  expect(mocks.convertBillableWork).toHaveBeenCalledWith({
    timeEntryIds: ["entry-1"],
    expenseIds: [],
    grouping: "entry",
    targetInvoiceId: null
  })
  expect(await screen.findByText("Nothing in the selection can be billed")).toBeInTheDocument()
})

test("offers only the draft invoices matching the selection's client and currency", async () => {
  const targets: BillableTargetInvoice[] = [
    { id: "invoice-1", number: "INV-0001", clientId: "client-1", currency: "EUR", totalCents: 0 },
    { id: "invoice-2", number: "INV-0002", clientId: "client-2", currency: "EUR", totalCents: 0 },
    { id: "invoice-3", number: "INV-0003", clientId: "client-1", currency: "USD", totalCents: 0 }
  ]

  const user = userEvent.setup()

  renderSheet({ targets })

  await user.click(screen.getByRole("combobox", { name: "invoices.billable.targetLabel" }))

  expect(screen.getByRole("option", { name: /INV-0001/ })).toBeInTheDocument()
  expect(screen.queryByRole("option", { name: /INV-0002/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("option", { name: /INV-0003/ })).not.toBeInTheDocument()
})
