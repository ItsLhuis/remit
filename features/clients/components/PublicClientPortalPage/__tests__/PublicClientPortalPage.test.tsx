import { cleanup, render, screen, within } from "@testing-library/react"

import { afterEach, describe, expect, test, vi } from "vitest"

import { axe } from "vitest-axe"

import { type ClientPortal } from "../../../types"
import { PublicClientPortalPage } from "../PublicClientPortalPage"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

// The four status badges come from feature barrels that also carry those features' `"use server"`
// modules, which Vitest evaluates for real and which boot `lib/config/env`. Each badge is covered by
// its own feature; what this file asserts is the portal's structure around them.
vi.mock("@/features/contracts", () => ({
  ContractStatusBadge: ({ status }: { status: string }) => <span>{status}</span>
}))

vi.mock("@/features/invoices", () => ({
  InvoiceStatusBadge: ({ status }: { status: string }) => <span>{status}</span>
}))

vi.mock("@/features/projects", () => ({
  ProjectStatusBadge: ({ status }: { status: string }) => <span>{status}</span>
}))

vi.mock("@/features/proposals", () => ({
  ProposalStatusBadge: ({ status }: { status: string }) => <span>{status}</span>
}))

function makePortal(overrides: Partial<ClientPortal> = {}): ClientPortal {
  return {
    clientName: "Northwind Ltd",
    issuer: { name: "Studio Remit", email: "billing@studio.test" },
    locale: "en",
    timeZone: "UTC",
    outstanding: [],
    invoices: [],
    proposals: [],
    contracts: [],
    projects: [],
    ...overrides
  }
}

function makeInvoice(overrides: Partial<ClientPortal["invoices"][number]> = {}) {
  return {
    number: "INV-0001",
    viewStatus: "sent" as const,
    currency: "EUR",
    totalCents: 123400,
    amountPaidCents: 0,
    outstandingCents: 123400,
    issueDate: new Date("2026-07-01T00:00:00.000Z"),
    dueDate: new Date("2026-07-31T00:00:00.000Z"),
    documentPath: "/i/token-invoice",
    creditNotes: [],
    ...overrides
  }
}

afterEach(() => {
  cleanup()
})

describe("PublicClientPortalPage", () => {
  test("names the client and the business the statement came from", () => {
    render(<PublicClientPortalPage portal={makePortal()} />)

    expect(screen.getByRole("heading", { name: "Northwind Ltd" })).toBeInTheDocument()
    expect(screen.getByText("Studio Remit")).toBeInTheDocument()
  })

  test("offers every section an empty state rather than a blank panel", () => {
    render(<PublicClientPortalPage portal={makePortal()} />)

    expect(screen.getByText("clients.public.invoices.emptyTitle")).toBeInTheDocument()
    expect(screen.getByText("clients.public.proposals.emptyTitle")).toBeInTheDocument()
    expect(screen.getByText("clients.public.contracts.emptyTitle")).toBeInTheDocument()
    expect(screen.getByText("clients.public.projects.emptyTitle")).toBeInTheDocument()
  })

  test("says nothing is outstanding when every invoice is settled", () => {
    render(
      <PublicClientPortalPage
        portal={makePortal({
          invoices: [makeInvoice({ amountPaidCents: 123400, outstandingCents: 0 })]
        })}
      />
    )

    expect(screen.getByText("clients.public.invoices.nothingOutstanding")).toBeInTheDocument()
  })

  test("reports what is owed once per currency", () => {
    render(
      <PublicClientPortalPage
        portal={makePortal({
          outstanding: [
            { currency: "EUR", totalCents: 98700 },
            { currency: "USD", totalCents: 50000 }
          ],
          invoices: [makeInvoice()]
        })}
      />
    )

    expect(screen.getByText("€987.00")).toBeInTheDocument()
    expect(screen.getByText("$500.00")).toBeInTheDocument()
  })

  test("opens an invoice through its own public link", () => {
    render(<PublicClientPortalPage portal={makePortal({ invoices: [makeInvoice()] })} />)

    expect(
      screen.getByRole("link", { name: "clients.public.invoices.open:INV-0001" })
    ).toHaveAttribute("href", "/i/token-invoice")
  })

  test("shows an invoice whose link was withdrawn without a way in", () => {
    render(
      <PublicClientPortalPage
        portal={makePortal({ invoices: [makeInvoice({ documentPath: null })] })}
      />
    )

    expect(screen.getByText("INV-0001")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  test("names a credit note against the invoice it corrects", () => {
    render(
      <PublicClientPortalPage
        portal={makePortal({
          invoices: [
            makeInvoice({
              creditNotes: [
                {
                  number: "CN-0001",
                  issuedAt: new Date("2026-07-10T00:00:00.000Z"),
                  totalCents: 10000
                }
              ]
            })
          ]
        })}
      />
    )

    expect(screen.getByText(/CN-0001/)).toBeInTheDocument()
  })

  test("never offers a way into a contract", () => {
    render(
      <PublicClientPortalPage
        portal={makePortal({
          contracts: [
            {
              number: "CTR-0001",
              title: "Master services agreement",
              status: "sent",
              issuedAt: new Date("2026-07-02T00:00:00.000Z"),
              effectiveFrom: new Date("2026-07-02T00:00:00.000Z"),
              effectiveUntil: null
            }
          ]
        })}
      />
    )

    const contracts = screen.getByText("CTR-0001").closest("li")

    expect(contracts).not.toBeNull()
    expect(within(contracts as HTMLElement).queryByRole("link")).not.toBeInTheDocument()
  })

  test("has no accessibility violations when every section is populated", async () => {
    const { container } = render(
      <PublicClientPortalPage
        portal={makePortal({
          outstanding: [{ currency: "EUR", totalCents: 123400 }],
          invoices: [makeInvoice()],
          proposals: [
            {
              number: "PROP-0001",
              status: "sent",
              currency: "EUR",
              totalCents: 500000,
              issuedAt: new Date("2026-07-01T00:00:00.000Z"),
              validUntil: new Date("2026-08-01T00:00:00.000Z"),
              documentPath: "/p/token-proposal"
            }
          ],
          contracts: [
            {
              number: "CTR-0001",
              title: "Master services agreement",
              status: "sent",
              issuedAt: new Date("2026-07-02T00:00:00.000Z"),
              effectiveFrom: new Date("2026-07-02T00:00:00.000Z"),
              effectiveUntil: null
            }
          ],
          projects: [
            {
              name: "Website rebuild",
              status: "active",
              startDate: new Date("2026-06-01T00:00:00.000Z"),
              endDate: null
            }
          ]
        })}
      />
    )

    expect((await axe(container)).violations).toEqual([])
  })
})
