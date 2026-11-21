import { expect, test } from "vitest"

import { parseSeedDemoArgs } from "../args"
import { DEFAULT_DEMO_SEED, DEFAULT_DEMO_SEED_SIZE } from "../inventory"
import { buildDemoSeedPlan } from "../plan"

const OWNER_ID = "3fdd6b4f-71b8-4dbb-b5e2-5b626c08348c"

// Public tokens are the one field a seed does not determine, so they are stripped before the
// comparison rather than the comparison being loosened: everything else still has to match byte for
// byte, and a second field going random would fail here.
function withoutPublicTokens(plan: ReturnType<typeof buildDemoSeedPlan>): string {
  return JSON.stringify(plan, (key, value) => (key === "publicToken" ? undefined : value))
}

test("builds byte-identical plans when the same seed is used", () => {
  const first = buildDemoSeedPlan(42, OWNER_ID)
  const second = buildDemoSeedPlan(42, OWNER_ID)

  expect(withoutPublicTokens(first)).toBe(withoutPublicTokens(second))
  expect(first.counts.clients).toBe(6)
  expect(first.counts.projects).toBe(11)
  expect(first.counts.invoices).toBe(6)
  expect(first.timeEntries[0]?.userId).toBe(OWNER_ID)
})

test("gives every seeded client its contacts, one of them primary", () => {
  const plan = buildDemoSeedPlan(42, OWNER_ID)

  const perClient = new Map<string, typeof plan.clientContacts>()

  for (const contact of plan.clientContacts) {
    perClient.set(contact.clientId, [...(perClient.get(contact.clientId) ?? []), contact])
  }

  expect(perClient.size).toBe(plan.counts.clients)

  for (const contacts of perClient.values()) {
    expect(contacts.filter((contact) => contact.isPrimary)).toHaveLength(1)
  }
})

test("scales deterministic plans when a larger seed size is used", () => {
  const medium = buildDemoSeedPlan(42, OWNER_ID, "medium")
  const large = buildDemoSeedPlan(42, OWNER_ID, "large")

  expect(medium.counts.clients).toBe(12)
  expect(medium.counts.projects).toBe(22)
  expect(medium.counts.invoices).toBe(12)
  expect(medium.counts.line_items).toBe(46)
  expect(large.counts.clients).toBe(24)
  expect(large.counts.projects).toBe(44)
  expect(large.counts.invoices).toBe(24)
  expect(large.counts.line_items).toBe(92)
})

test("builds custom-sized plans for stress-test data", () => {
  const plan = buildDemoSeedPlan(42, OWNER_ID, "small", {
    clients: 1000,
    projects: 4000,
    invoices: 20000
  })

  expect(plan.size).toBe("custom")
  expect(plan.counts.clients).toBe(1000)
  expect(plan.counts.projects).toBe(4000)
  expect(plan.counts.invoices).toBe(20000)
  expect(plan.counts.line_items).toBe(46934)
}, 15_000)

test("builds different deterministic identifiers when the seed changes", () => {
  const first = buildDemoSeedPlan(42, OWNER_ID)
  const second = buildDemoSeedPlan(43, OWNER_ID)

  expect(first.clients[0]?.id).not.toBe(second.clients[0]?.id)
})

test("mints a fresh public token on every plan built from the same seed", () => {
  const first = buildDemoSeedPlan(42, OWNER_ID)
  const second = buildDemoSeedPlan(42, OWNER_ID)

  expect(first.invoices[0]?.publicToken).not.toBe(second.invoices[0]?.publicToken)
  expect(first.proposals[0]?.publicToken).not.toBe(second.proposals[0]?.publicToken)
  expect(first.contracts[0]?.publicToken).not.toBe(second.contracts[0]?.publicToken)
})

test("parses supported CLI flags", () => {
  const parsed = parseSeedDemoArgs([
    "--dry-run",
    "--yes",
    "--reseed",
    "--seed",
    "42",
    "--size",
    "large"
  ])

  expect(parsed).toEqual({
    data: {
      countOverrides: {},
      dryRun: true,
      help: false,
      reseed: true,
      seed: 42,
      size: "large",
      yes: true
    }
  })
})

test("parses numeric seed count overrides", () => {
  const parsed = parseSeedDemoArgs(["--size", "1000", "--projects", "4000", "--invoices", "20000"])

  expect(parsed).toEqual({
    data: {
      countOverrides: {
        clients: 1000,
        projects: 4000,
        invoices: 20000
      },
      dryRun: false,
      help: false,
      reseed: false,
      seed: DEFAULT_DEMO_SEED,
      size: DEFAULT_DEMO_SEED_SIZE,
      yes: false
    }
  })
})

test("rejects unsupported seed sizes", () => {
  const parsed = parseSeedDemoArgs(["--size", "huge"])

  expect(parsed).toEqual({
    error: "--size must be one of small, medium, large or a client count from 1 to 1000."
  })
})

test("rejects count overrides above the configured maximum", () => {
  const parsed = parseSeedDemoArgs(["--invoices", "20001"])

  expect(parsed).toEqual({
    error: "--invoices must be an integer from 0 to 20000."
  })
})

test("uses the default seed when no seed flag is provided", () => {
  const parsed = parseSeedDemoArgs([])

  expect(parsed).toEqual({
    data: {
      countOverrides: {},
      dryRun: false,
      help: false,
      reseed: false,
      seed: DEFAULT_DEMO_SEED,
      size: DEFAULT_DEMO_SEED_SIZE,
      yes: false
    }
  })
})
