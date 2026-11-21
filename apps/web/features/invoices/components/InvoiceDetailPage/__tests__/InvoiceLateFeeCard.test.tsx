import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { type InvoiceLateFee } from "../../../types"
import { InvoiceLateFeeCard } from "../InvoiceLateFeeCard"

const mocks = vi.hoisted(() => ({
  adjustInvoiceLateFee: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh })
}))

vi.mock("../../../mutations", () => ({
  adjustInvoiceLateFee: mocks.adjustInvoiceLateFee
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui")>("@/components/ui")

  return {
    ...actual,
    toast: { success: mocks.toastSuccess }
  }
})

const invoiceId = "44444444-4444-4444-8444-444444444444"

function makeLateFee(overrides?: Partial<InvoiceLateFee>): InvoiceLateFee {
  return {
    feeCents: 5_000,
    appliedAt: null,
    daysLate: null,
    policy: null,
    shownOnDocument: true,
    ...overrides
  }
}

function renderCard(lateFee: InvoiceLateFee) {
  return render(
    <TooltipProvider>
      <InvoiceLateFeeCard
        invoiceId={invoiceId}
        currency="EUR"
        locale="en"
        timeZone="UTC"
        lateFee={lateFee}
      />
    </TooltipProvider>
  )
}

describe("invoice late fee card", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  test("flags a charged fee the invoice's template leaves off the PDF", () => {
    renderCard(makeLateFee({ shownOnDocument: false }))

    expect(screen.getByText("invoices.detail.lateFeeNotOnDocumentTitle")).toBeInTheDocument()
  })

  test("raises no flag when the layout prints the fee", () => {
    renderCard(makeLateFee({ shownOnDocument: true }))

    expect(screen.queryByText("invoices.detail.lateFeeNotOnDocumentTitle")).toBeNull()
  })

  test("raises no flag for a waived fee, which has nothing to print", () => {
    renderCard(makeLateFee({ feeCents: 0, shownOnDocument: false }))

    expect(screen.getByText("invoices.detail.lateFeeWaived")).toBeInTheDocument()
    expect(screen.queryByText("invoices.detail.lateFeeNotOnDocumentTitle")).toBeNull()
  })

  test("saves an adjusted fee and refreshes the invoice", async () => {
    const user = userEvent.setup()

    mocks.adjustInvoiceLateFee.mockResolvedValue({ data: { id: invoiceId, lateFeeCents: 2_000 } })

    renderCard(makeLateFee())

    await user.click(screen.getByRole("button", { name: "invoices.detail.lateFeeAdjust" }))
    await user.clear(screen.getByLabelText("invoices.detail.lateFeeAmountLabel"))
    await user.type(screen.getByLabelText("invoices.detail.lateFeeAmountLabel"), "20.00")
    await user.click(screen.getByRole("button", { name: "invoices.detail.lateFeeSave" }))

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())

    expect(mocks.adjustInvoiceLateFee).toHaveBeenCalledWith({ id: invoiceId, lateFee: "20.00" })
    expect(mocks.toastSuccess).toHaveBeenCalledWith("invoices.notifications.lateFeeUpdated")
  })

  test("keeps the dialog open with the server's reason when the adjustment is refused", async () => {
    const user = userEvent.setup()

    mocks.adjustInvoiceLateFee.mockResolvedValue({ error: "The fee cannot go below what was paid" })

    renderCard(makeLateFee())

    await user.click(screen.getByRole("button", { name: "invoices.detail.lateFeeAdjust" }))
    await user.click(screen.getByRole("button", { name: "invoices.detail.lateFeeSave" }))

    expect(await screen.findByText("The fee cannot go below what was paid")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
