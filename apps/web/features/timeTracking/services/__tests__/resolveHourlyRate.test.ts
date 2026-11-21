import { describe, expect, test } from "vitest"

import { resolveHourlyRate, type HourlyRateSources } from "../resolveHourlyRate"

const RUNGS = ["entry", "task", "project", "client", "settings"] as const

type Rung = (typeof RUNGS)[number]

// A distinct rate per rung, so asserting on `rateCents` proves which rung answered and not merely
// that the returned `source` string was spelled correctly.
const RUNG_RATE_CENTS: Record<Rung, number> = {
  entry: 11_000,
  task: 12_000,
  project: 13_000,
  client: 14_000,
  settings: 15_000
}

const RUNG_PAIRS = RUNGS.flatMap((higher, index) =>
  RUNGS.slice(index + 1).map((lower) => ({ higher, lower }))
)

function buildSources(rates: Partial<Record<Rung, number>>): HourlyRateSources {
  return {
    entry: { hourlyRateOverrideCents: rates.entry ?? null },
    task: { hourlyRateCents: rates.task ?? null },
    project: { hourlyRateCents: rates.project ?? null },
    client: { defaultHourlyRateCents: rates.client ?? null },
    settings: { defaultHourlyRateCents: rates.settings ?? null }
  }
}

function ratesBelow(rung: Rung): Partial<Record<Rung, number>> {
  return Object.fromEntries(
    RUNGS.slice(RUNGS.indexOf(rung) + 1).map((lower) => [lower, RUNG_RATE_CENTS[lower]])
  )
}

describe("resolveHourlyRate", () => {
  test.each(RUNG_PAIRS)(
    "prefers the $higher rate over the $lower rate when both are set",
    ({ higher, lower }) => {
      const sources = buildSources({
        [higher]: RUNG_RATE_CENTS[higher],
        [lower]: RUNG_RATE_CENTS[lower]
      })

      const result = resolveHourlyRate(sources)

      expect(result).toEqual({ rateCents: RUNG_RATE_CENTS[higher], source: higher })
    }
  )

  test.each(RUNGS)("falls through to the %s rate when every higher rate is unset", (rung) => {
    const sources = buildSources({ [rung]: RUNG_RATE_CENTS[rung] })

    const result = resolveHourlyRate(sources)

    expect(result).toEqual({ rateCents: RUNG_RATE_CENTS[rung], source: rung })
  })

  test.each(RUNGS)("treats a zero rate on %s as set rather than as missing", (rung) => {
    const sources = buildSources({ ...ratesBelow(rung), [rung]: 0 })

    const result = resolveHourlyRate(sources)

    expect(result).toEqual({ rateCents: 0, source: rung })
  })

  test("resolves to no rate when nothing is configured at any level", () => {
    const sources = buildSources({})

    const result = resolveHourlyRate(sources)

    expect(result).toEqual({ rateCents: 0, source: "none" })
  })

  test("resolves to no rate when every source row is absent", () => {
    const result = resolveHourlyRate({
      entry: null,
      task: null,
      project: null,
      client: null,
      settings: null
    })

    expect(result).toEqual({ rateCents: 0, source: "none" })
  })
})
