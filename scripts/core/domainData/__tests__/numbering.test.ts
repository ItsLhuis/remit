import { expect, test } from "vitest"

import {
  advanceCountersPastSeed,
  parseSeedNumbering,
  selectRewindableCounters,
  type NumberingCounters
} from "../numbering"

const FRESH: NumberingCounters = { invoice: 1, proposal: 1, contract: 1, creditNote: 1 }

test("advances every counter past the numbers the seed used", () => {
  const after = advanceCountersPastSeed(FRESH, {
    invoice: 40,
    proposal: 12,
    contract: 3,
    creditNote: 0
  })

  expect(after).toEqual({ invoice: 41, proposal: 13, contract: 4, creditNote: 1 })
})

test("leaves a counter that is already past the seeded numbers where it is", () => {
  const after = advanceCountersPastSeed(
    { ...FRESH, invoice: 120 },
    { invoice: 40, proposal: 0, contract: 0, creditNote: 0 }
  )

  expect(after.invoice).toBe(120)
})

test("rewinds a counter that has issued nothing since the seed", () => {
  const seed = { before: FRESH, after: { ...FRESH, invoice: 41, proposal: 13 } }

  const rewound = selectRewindableCounters({ ...FRESH, invoice: 41, proposal: 13 }, seed)

  expect(rewound).toEqual({ invoice: 1, proposal: 1 })
})

test("keeps a counter that issued a real number after the seed", () => {
  const seed = { before: FRESH, after: { ...FRESH, invoice: 41, proposal: 13 } }

  const rewound = selectRewindableCounters({ ...FRESH, invoice: 42, proposal: 13 }, seed)

  expect(rewound).toEqual({ proposal: 1 })
})

test("rewinds nothing the seed did not advance", () => {
  const seed = { before: { ...FRESH, invoice: 120 }, after: { ...FRESH, invoice: 120 } }

  const rewound = selectRewindableCounters({ ...FRESH, invoice: 120 }, seed)

  expect(rewound).toEqual({})
})

test("treats an audit entry without numbering as nothing to rewind", () => {
  expect(parseSeedNumbering({ counts: { invoices: 4 } })).toBeNull()
  expect(parseSeedNumbering(null)).toBeNull()
})
