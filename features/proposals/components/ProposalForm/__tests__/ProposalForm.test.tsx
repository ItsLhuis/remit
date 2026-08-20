import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { type ProposalEditorData, type ProposalFormData } from "../../../types"
import { ProposalForm } from "../ProposalForm"

type CurrencySelectProps = {
  disabled?: boolean
  id?: string
  onValueChangeAction?: (value: string) => void
  valid?: boolean
  value?: string
}

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  createProposal: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  updateProposal: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mocks.back,
    push: mocks.push,
    refresh: mocks.refresh
  })
}))

vi.mock("../../../mutations", () => ({
  createProposal: mocks.createProposal,
  updateProposal: mocks.updateProposal
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
    CurrencySelect: ({
      disabled,
      id,
      onValueChangeAction,
      valid = true,
      value
    }: CurrencySelectProps) => (
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        aria-invalid={!valid}
        onChange={(event) => onValueChangeAction?.(event.target.value)}
      >
        <option value="EUR">EUR</option>
        <option value="USD">USD</option>
      </select>
    ),
    toast: { ...actual.toast, success: mocks.toastSuccess }
  }
})

const editor: ProposalEditorData = {
  projectId: "00000000-0000-4000-8000-000000000c01",
  projectName: "Marketing site",
  defaults: {
    defaultCurrency: "EUR",
    defaultLocale: "en",
    defaultTimezone: "UTC",
    proposalValidityDays: 30,
    defaultNotesProposal: ""
  },
  taxRates: [
    { id: "00000000-0000-4000-8000-000000000c02", name: "VAT 23", percentage: 23, isDefault: false }
  ],
  templates: [],
  parentOptions: {
    projects: [{ id: "00000000-0000-4000-8000-000000000c01", name: "Marketing site" }],
    clients: [{ id: "00000000-0000-4000-8000-000000000c04", name: "Acme" }]
  }
}

const draft: ProposalFormData = {
  id: "00000000-0000-4000-8000-000000000c03",
  number: "PROP-0001",
  status: "draft",
  projectId: "00000000-0000-4000-8000-000000000c01",
  clientId: "",
  currency: "EUR",
  templateId: "",
  validUntil: "",
  notes: "",
  discountKind: "none",
  discountPercentage: "",
  discountAmount: "",
  lineItems: [
    {
      description: "Discovery",
      unit: "",
      quantity: "1",
      unitPrice: "100.00",
      discountKind: "none",
      discountPercentage: "",
      discountAmount: "",
      taxRateId: ""
    }
  ]
}

// IconButton renders a Radix Tooltip, which throws outside a provider the app supplies globally.
function renderForm(proposal: ProposalFormData | null) {
  return render(
    <TooltipProvider>
      <ProposalForm editor={editor} proposal={proposal} />
    </TooltipProvider>
  )
}

describe("ProposalForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createProposal.mockResolvedValue({ data: { proposal: { ...draft } } })
    mocks.updateProposal.mockResolvedValue({ data: { proposal: { ...draft } } })
  })

  afterEach(cleanup)

  test("prices the live total from the typed line item", async () => {
    const user = userEvent.setup()

    renderForm(null)

    await user.type(screen.getByLabelText("proposals.lineItems.descriptionColumn"), "Workshop")
    await user.clear(screen.getByLabelText("proposals.lineItems.quantityColumn"))
    await user.type(screen.getByLabelText("proposals.lineItems.quantityColumn"), "3")
    await user.type(screen.getByLabelText("proposals.lineItems.unitPriceColumn"), "250.00")

    expect(await screen.findAllByText("€750.00")).not.toHaveLength(0)
  })

  test("adds and removes a line item row", async () => {
    const user = userEvent.setup()

    renderForm(null)

    await user.click(screen.getByRole("button", { name: "proposals.lineItems.addButton" }))

    expect(screen.getAllByLabelText("proposals.lineItems.descriptionColumn")).toHaveLength(2)

    await user.click(screen.getAllByRole("button", { name: "proposals.lineItems.removeButton" })[1])

    expect(screen.getAllByLabelText("proposals.lineItems.descriptionColumn")).toHaveLength(1)
  })

  // The typed strings, not the schema's transformed cents: createProposal re-validates with a
  // schema built from the same string-input shape, so the amount has to stay "100.00" on the wire.
  test("submits the field values to createProposal and navigates to the new proposal", async () => {
    const user = userEvent.setup()

    renderForm(null)

    await user.type(screen.getByLabelText("proposals.lineItems.descriptionColumn"), "Workshop")
    await user.type(screen.getByLabelText("proposals.lineItems.unitPriceColumn"), "100.00")
    await user.click(screen.getByRole("button", { name: /proposals.form.saveCreate/ }))

    await waitFor(() => expect(mocks.createProposal).toHaveBeenCalledTimes(1))

    expect(mocks.createProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: editor.projectId,
        lineItems: [expect.objectContaining({ description: "Workshop", unitPrice: "100.00" })]
      })
    )
    expect(mocks.push).toHaveBeenCalledWith(`/proposals/${draft.id}`)
  })

  test("surfaces a server error instead of navigating away", async () => {
    const user = userEvent.setup()

    mocks.createProposal.mockResolvedValue({ error: "Only draft proposals can be changed" })

    renderForm(null)

    await user.type(screen.getByLabelText("proposals.lineItems.descriptionColumn"), "Workshop")
    await user.type(screen.getByLabelText("proposals.lineItems.unitPriceColumn"), "100.00")
    await user.click(screen.getByRole("button", { name: /proposals.form.saveCreate/ }))

    expect(await screen.findByText("Only draft proposals can be changed")).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  test("keeps every row's total correct when a row in the middle is removed", async () => {
    const user = userEvent.setup()

    renderForm(null)

    for (let index = 0; index < 3; index++) {
      await user.click(screen.getByRole("button", { name: "proposals.lineItems.addButton" }))
    }

    const unitPrices = screen.getAllByLabelText("proposals.lineItems.unitPriceColumn")

    for (const [index, unitPrice] of unitPrices.entries()) {
      await user.type(unitPrice, `${(index + 1) * 100}.00`)
    }

    expect(await screen.findAllByText("€1,000.00")).not.toHaveLength(0)

    await user.click(screen.getAllByRole("button", { name: "proposals.lineItems.removeButton" })[1])

    expect(await screen.findAllByText("€800.00")).not.toHaveLength(0)
    expect(screen.getByText("€100.00")).toBeInTheDocument()
    expect(screen.getByText("€300.00")).toBeInTheDocument()
    expect(screen.getByText("€400.00")).toBeInTheDocument()
    expect(screen.queryByText("€200.00")).not.toBeInTheDocument()
  })

  test("blocks submission while an existing draft is untouched", () => {
    renderForm(draft)

    expect(screen.getByRole("button", { name: /proposals.form.saveEdit/ })).toBeDisabled()
  })
})
