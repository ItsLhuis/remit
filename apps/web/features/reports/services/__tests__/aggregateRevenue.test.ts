import { describe, expect, test } from "vitest"

import { aggregateRevenue, type RevenueReportRow } from "../aggregateRevenue"

function makeRow(overrides: Partial<RevenueReportRow> = {}): RevenueReportRow {
  return {
    key: "client-a",
    label: "Client A",
    sublabel: null,
    currency: "EUR",
    totalCents: 100_000,
    creditedCents: 0,
    amountPaidCents: 0,
    ...overrides
  }
}

describe("aggregateRevenue", () => {
  test("returns nothing when no invoice was issued", () => {
    expect(aggregateRevenue([]).groups).toEqual([])
  })

  test("subtracts credit notes from net revenue while leaving the invoiced value intact", () => {
    const result = aggregateRevenue([makeRow({ totalCents: 100_000, creditedCents: 25_000 })])

    expect(result.groups[0]?.rows[0]?.cells).toEqual([
      { kind: "count", value: 1 },
      { kind: "money", cents: 100_000 },
      { kind: "money", cents: 25_000 },
      { kind: "money", cents: 75_000 },
      { kind: "money", cents: 0 },
      { kind: "money", cents: 75_000 }
    ])
  })

  test("clamps outstanding per invoice so an over-credited one cannot offset another", () => {
    const result = aggregateRevenue([
      makeRow({ key: "a", totalCents: 40_000, creditedCents: 90_000 }),
      makeRow({ key: "b", totalCents: 60_000 })
    ])

    const total = result.groups[0]?.totals[5]

    expect(total).toEqual({ kind: "money", cents: 60_000 })
  })

  test("groups a client billed in two currencies into two rows and never adds them", () => {
    const result = aggregateRevenue([
      makeRow({ currency: "EUR", totalCents: 100_000 }),
      makeRow({ currency: "USD", totalCents: 40_000 })
    ])

    expect(result.groups).toHaveLength(2)
    expect(result.groups.map((group) => group.currency).toSorted()).toEqual(["EUR", "USD"])
    expect(result.groups.map((group) => group.totals[1])).toEqual(
      expect.arrayContaining([
        { kind: "money", cents: 100_000 },
        { kind: "money", cents: 40_000 }
      ])
    )
  })

  test("counts every invoice in a bucket even when its value is fully credited", () => {
    const result = aggregateRevenue([
      makeRow({ totalCents: 50_000, creditedCents: 50_000 }),
      makeRow({ totalCents: 50_000 })
    ])

    expect(result.groups[0]?.totals[0]).toEqual({ kind: "count", value: 2 })
    expect(result.groups[0]?.totals[3]).toEqual({ kind: "money", cents: 50_000 })
  })
})
