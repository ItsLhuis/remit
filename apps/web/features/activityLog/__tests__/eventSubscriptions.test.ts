// @vitest-environment node

import { expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  subscribed: [] as string[]
}))

vi.mock("@/lib/events", () => ({
  on: (event: string) => {
    mocks.subscribed.push(event)
  }
}))

// Registration reads no table, so the database and the schema — whose helpers boot the environment
// validator — are stubbed; the handlers they would serve never run here.
vi.mock("@/database", () => ({ database: {} }))

vi.mock("@/database/schema", () => ({}))

vi.mock("@/features/leads/server", () => ({ formatLeadName: vi.fn() }))

// Hardcoded rather than derived from the subscriber modules, because this list is the guard: it is
// every event the feed subscribed to while one module held them all, and reading it back out of the
// modules under test would let a dropped subscription agree with itself.
const FEED_EVENTS = [
  "client.created",
  "lead.converted",
  "project.created",
  "project.status_changed",
  "proposal.sent",
  "proposal.accepted",
  "proposal.rejected",
  "contract.signed",
  "invoice.sent",
  "invoice.paid",
  "invoice.overdue",
  "invoice.late_fee_applied",
  "recurring.invoice_generated",
  "retainer.pool_exhausted",
  "credit_note.issued",
  "payment.received",
  "time.logged",
  "expense.created"
]

test("subscribes the feed to every event it records, once each, from the one bootstrap import", async () => {
  await import("../events")

  expect(mocks.subscribed.toSorted()).toEqual(FEED_EVENTS.toSorted())
})
