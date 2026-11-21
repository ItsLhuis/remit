import { cleanup, render, screen } from "@testing-library/react"

import { afterEach, describe, expect, test, vi } from "vitest"

import { type PeriodDelta } from "../../../services"
import { MetricDelta } from "../MetricDelta"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

function makeDelta(overrides: Partial<PeriodDelta> = {}): PeriodDelta {
  return {
    currentCents: 120_000,
    previousCents: 100_000,
    changePercentage: 20,
    direction: "up",
    ...overrides
  }
}

afterEach(cleanup)

describe("MetricDelta", () => {
  test("says there is nothing to compare against for the all-time period", () => {
    render(
      <MetricDelta
        delta={makeDelta({ previousCents: null, changePercentage: null, direction: "unknown" })}
        currency="EUR"
        locale="en"
      />
    )

    expect(screen.getByText("dashboard.metrics.comparisonNone")).toBeInTheDocument()
  })

  test("reports a rise with no percentage when the previous period banked nothing", () => {
    render(
      <MetricDelta
        delta={makeDelta({ previousCents: 0, changePercentage: null, direction: "up" })}
        currency="EUR"
        locale="en"
      />
    )

    expect(screen.getByText("dashboard.metrics.upFromNothing")).toBeInTheDocument()
  })

  test("reports a fall as a downward change", () => {
    render(
      <MetricDelta
        delta={makeDelta({ changePercentage: -25, direction: "down" })}
        currency="EUR"
        locale="en"
      />
    )

    expect(screen.getByText("dashboard.metrics.down")).toBeInTheDocument()
  })

  test("reports an unchanged period as flat", () => {
    render(
      <MetricDelta
        delta={makeDelta({ changePercentage: 0, direction: "flat" })}
        currency="EUR"
        locale="en"
      />
    )

    expect(screen.getByText("dashboard.metrics.flat")).toBeInTheDocument()
  })

  test("shows the amount the previous period is being compared against", () => {
    render(<MetricDelta delta={makeDelta()} currency="EUR" locale="en" />)

    expect(screen.getByText("dashboard.metrics.comparison")).toBeInTheDocument()
  })
})
