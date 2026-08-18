import { type ReactNode } from "react"

import { cleanup, render, screen } from "@testing-library/react"

import { afterEach, describe, expect, test, vi } from "vitest"

import { axe } from "vitest-axe"

import { TooltipProvider } from "@/components/ui"

import { type ReceivablesAging } from "../../../services"
import { type DashboardReceivables } from "../../../types"
import { PositionPanel } from "../PositionPanel"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

const EMPTY_AGING: ReceivablesAging = {
  buckets: [
    { id: "notDue", cents: 0, count: 0, sharePercentage: 0 },
    { id: "days1To30", cents: 0, count: 0, sharePercentage: 0 },
    { id: "days31To60", cents: 0, count: 0, sharePercentage: 0 },
    { id: "days61Plus", cents: 0, count: 0, sharePercentage: 0 }
  ],
  totalCents: 0,
  lateCents: 0,
  oldestDaysLate: 0
}

const AGING: ReceivablesAging = {
  buckets: [
    { id: "notDue", cents: 60_000, count: 2, sharePercentage: 60 },
    { id: "days1To30", cents: 40_000, count: 1, sharePercentage: 40 },
    { id: "days31To60", cents: 0, count: 0, sharePercentage: 0 },
    { id: "days61Plus", cents: 0, count: 0, sharePercentage: 0 }
  ],
  totalCents: 100_000,
  lateCents: 40_000,
  oldestDaysLate: 12
}

function makeReceivables(overrides: Partial<DashboardReceivables> = {}): DashboardReceivables {
  return {
    outstandingCents: 100_000,
    outstandingCount: 3,
    overdueCents: 40_000,
    overdueCount: 1,
    ...overrides
  }
}

// The app mounts one `TooltipProvider` at the root (app/layout.tsx); the hint buttons inside the
// panel need it here too, so every render in this file goes through it.
function renderPanel(ui: ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

afterEach(cleanup)

describe("PositionPanel", () => {
  test("renders its empty state rather than a hero zero when nothing is outstanding", () => {
    renderPanel(
      <PositionPanel
        receivables={makeReceivables({
          outstandingCents: 0,
          outstandingCount: 0,
          overdueCents: 0,
          overdueCount: 0
        })}
        aging={EMPTY_AGING}
        currency="EUR"
        locale="en"
      />
    )

    expect(screen.getByText("dashboard.position.emptyTitle")).toBeInTheDocument()
    expect(screen.queryByText("dashboard.position.agingTitle")).not.toBeInTheDocument()
  })

  test("says nothing is late rather than showing a zero overdue amount", () => {
    renderPanel(
      <PositionPanel
        receivables={makeReceivables({ overdueCents: 0, overdueCount: 0 })}
        aging={{ ...AGING, lateCents: 0, oldestDaysLate: 0 }}
        currency="EUR"
        locale="en"
      />
    )

    expect(screen.getByText("dashboard.position.overdueNone")).toBeInTheDocument()
    expect(screen.queryByText("dashboard.position.overdueLabel")).not.toBeInTheDocument()
  })

  test("reports the age of the oldest late invoice when something is late", () => {
    renderPanel(
      <PositionPanel receivables={makeReceivables()} aging={AGING} currency="EUR" locale="en" />
    )

    expect(screen.getByText("dashboard.position.oldest")).toBeInTheDocument()
  })

  test("gives the aging bar a label rather than leaving it as bare colour", () => {
    renderPanel(
      <PositionPanel receivables={makeReceivables()} aging={AGING} currency="EUR" locale="en" />
    )

    expect(screen.getByRole("img", { name: "dashboard.position.meterLabel" })).toBeInTheDocument()
  })

  test("has no accessibility violations when populated", async () => {
    const { container } = renderPanel(
      <PositionPanel receivables={makeReceivables()} aging={AGING} currency="EUR" locale="en" />
    )

    expect((await axe(container)).violations).toEqual([])
  })
})
