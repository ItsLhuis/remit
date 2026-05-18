import { expect, test } from "vitest"

import { DEFAULT_DEMO_SEED, buildDemoSeedPlan, parseSeedDemoArgs } from "../seed-demo"

const OWNER_ID = "3fdd6b4f-71b8-4dbb-b5e2-5b626c08348c"

test("builds byte-identical plans when the same seed is used", () => {
  const first = buildDemoSeedPlan(42, OWNER_ID)
  const second = buildDemoSeedPlan(42, OWNER_ID)

  expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  expect(first.counts.clients).toBe(6)
  expect(first.counts.projects).toBe(11)
  expect(first.counts.invoices).toBe(6)
  expect(first.timeEntries[0]?.userId).toBe(OWNER_ID)
})

test("builds different deterministic identifiers when the seed changes", () => {
  const first = buildDemoSeedPlan(42, OWNER_ID)
  const second = buildDemoSeedPlan(43, OWNER_ID)

  expect(first.clients[0]?.id).not.toBe(second.clients[0]?.id)
  expect(first.invoices[0]?.publicToken).not.toBe(second.invoices[0]?.publicToken)
})

test("parses supported CLI flags", () => {
  const parsed = parseSeedDemoArgs(["--dry-run", "--yes", "--reseed", "--seed", "42"])

  expect(parsed).toEqual({
    data: {
      dryRun: true,
      help: false,
      reseed: true,
      seed: 42,
      yes: true
    }
  })
})

test("uses the default seed when no seed flag is provided", () => {
  const parsed = parseSeedDemoArgs([])

  expect(parsed).toEqual({
    data: {
      dryRun: false,
      help: false,
      reseed: false,
      seed: DEFAULT_DEMO_SEED,
      yes: false
    }
  })
})
