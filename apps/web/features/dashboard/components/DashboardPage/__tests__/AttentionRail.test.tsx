import { cleanup, render, screen } from "@testing-library/react"

import { afterEach, describe, expect, test, vi } from "vitest"

import { axe } from "vitest-axe"

import { type AttentionItem } from "../../../services"
import { AttentionRail } from "../AttentionRail"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

function makeItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: "invoiceOverdue:invoice-1",
    kind: "invoiceOverdue",
    severity: "error",
    subject: "INV-0001",
    context: "Acme",
    days: 5,
    amountCents: 50_000,
    currency: "EUR",
    href: "/projects/project-1/invoices/invoice-1",
    ...overrides
  }
}

afterEach(cleanup)

describe("AttentionRail", () => {
  test("shows the empty state with no call to action when nothing needs the reader", () => {
    render(<AttentionRail items={[]} totalCount={0} locale="en" />)

    expect(screen.getByText("dashboard.attention.emptyTitle")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  test("links each row to the document it is about", () => {
    render(<AttentionRail items={[makeItem()]} totalCount={1} locale="en" />)

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/projects/project-1/invoices/invoice-1"
    )
  })

  test("names the kind of each row for screen readers", () => {
    render(<AttentionRail items={[makeItem()]} totalCount={1} locale="en" />)

    expect(screen.getByText("dashboard.attention.kindLabels.invoiceOverdue")).toBeInTheDocument()
  })

  test("says how many further items are behind the ones it shows", () => {
    render(<AttentionRail items={[makeItem()]} totalCount={9} locale="en" />)

    expect(screen.getByText("dashboard.attention.more")).toBeInTheDocument()
  })

  test("says nothing about further items when it is showing all of them", () => {
    render(<AttentionRail items={[makeItem()]} totalCount={1} locale="en" />)

    expect(screen.queryByText("dashboard.attention.more")).not.toBeInTheDocument()
  })

  test("omits the amount for an item that carries no money", () => {
    render(
      <AttentionRail
        items={[makeItem({ kind: "taskDue", amountCents: null, currency: null })]}
        totalCount={1}
        locale="en"
      />
    )

    expect(screen.queryByText(/€/)).not.toBeInTheDocument()
  })

  test("has no accessibility violations when populated", async () => {
    const { container } = render(<AttentionRail items={[makeItem()]} totalCount={4} locale="en" />)

    expect((await axe(container)).violations).toEqual([])
  })
})
