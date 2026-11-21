import { expect, test } from "vitest"

import { toAuditArguments } from "../toolAudit"

test("records that a search was made without recording what was searched for", () => {
  const recorded = toAuditArguments({ search: "Acme Holdings", page: 1, perPage: 25 })

  expect(recorded).toEqual({ searched: true, page: 1, perPage: 25 })
  expect(JSON.stringify(recorded)).not.toContain("Acme")
})

test("keeps ids, days, flags and states as they were asked for", () => {
  const recorded = toAuditArguments({
    clientId: "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c",
    statuses: ["overdue"],
    dueTo: "2026-03-31",
    invoiced: false
  })

  expect(recorded).toEqual({
    clientId: "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c",
    statuses: ["overdue"],
    dueTo: "2026-03-31",
    invoiced: false
  })
})

test("leaves out arguments the assistant did not give", () => {
  const recorded = toAuditArguments({ search: undefined, projectId: undefined, page: 3 })

  expect(recorded).toEqual({ page: 3 })
})
