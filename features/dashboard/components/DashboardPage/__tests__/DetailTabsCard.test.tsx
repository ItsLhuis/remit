import { type ReactNode } from "react"

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, describe, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { type TopClient, type UpcomingInvoice, type UpcomingSchedule } from "../../../services"
import { DetailTabsCard } from "../DetailTabsCard"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

// The chart is loaded through `next/dynamic` with `ssr: false`, so it is stubbed here: the tab
// behaviour under test is the disclosure, not recharts, and mounting it would pull the chart chunk
// into every run of this file.
vi.mock("../charts", () => ({
  TopClientsChart: () => <div data-testid="top-clients-chart" />
}))

const INVOICES: UpcomingInvoice[] = [
  {
    id: "invoice-1",
    number: "INV-0001",
    parentName: "Acme",
    currency: "EUR",
    dueDate: new Date("2026-09-01T00:00:00.000Z"),
    receivableCents: 50_000,
    daysUntilDue: 4
  }
]

const SCHEDULES: UpcomingSchedule[] = [
  {
    id: "schedule-1",
    name: "Monthly retainer",
    clientName: "Acme",
    cadence: "monthly",
    nextRunAt: new Date("2026-09-01T00:00:00.000Z"),
    daysUntilRun: 15
  }
]

const CLIENTS: TopClient[] = [
  { clientId: "client-1", name: "Acme", revenueCents: 500_000, sharePercentage: 62.5 }
]

// The due-date badges carry tooltips, and the provider that serves them is mounted at the app root
// (app/layout.tsx) rather than by the card.
function renderCard(ui: ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

afterEach(cleanup)

describe("DetailTabsCard", () => {
  test("opens on the due-soon list", () => {
    renderCard(
      <DetailTabsCard
        invoices={INVOICES}
        schedules={SCHEDULES}
        clients={CLIENTS}
        currency="EUR"
        locale="en"
      />
    )

    expect(screen.getByText("INV-0001")).toBeInTheDocument()
    expect(screen.queryByText("Monthly retainer")).not.toBeInTheDocument()
  })

  test("switches to the recurring list when its tab is chosen", async () => {
    const user = userEvent.setup()

    renderCard(
      <DetailTabsCard
        invoices={INVOICES}
        schedules={SCHEDULES}
        clients={CLIENTS}
        currency="EUR"
        locale="en"
      />
    )

    await user.click(screen.getByRole("tab", { name: "dashboard.detail.tabs.schedules" }))

    expect(screen.getByText("Monthly retainer")).toBeInTheDocument()
  })

  test("reaches the top-clients tab with the keyboard alone", async () => {
    const user = userEvent.setup()

    renderCard(
      <DetailTabsCard
        invoices={INVOICES}
        schedules={SCHEDULES}
        clients={CLIENTS}
        currency="EUR"
        locale="en"
      />
    )

    await user.click(screen.getByRole("tab", { name: "dashboard.detail.tabs.due" }))
    await user.keyboard("{ArrowRight}{ArrowRight}")

    expect(screen.getByRole("link", { name: "Acme" })).toHaveAttribute("href", "/clients/client-1")
  })

  test("shows a per-tab empty state rather than an empty table", async () => {
    const user = userEvent.setup()

    renderCard(
      <DetailTabsCard
        invoices={INVOICES}
        schedules={[]}
        clients={CLIENTS}
        currency="EUR"
        locale="en"
      />
    )

    await user.click(screen.getByRole("tab", { name: "dashboard.detail.tabs.schedules" }))

    expect(screen.getByText("dashboard.schedules.emptyTitle")).toBeInTheDocument()
  })
})
