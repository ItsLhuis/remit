import { expect, test } from "vitest"

import { resolveRestoreBlocker } from "../restoreEligibility"

test("allows a restore when the record has no parents", () => {
  const blocker = resolveRestoreBlocker([])

  expect(blocker).toBeNull()
})

test("allows a restore when every parent is live", () => {
  const blocker = resolveRestoreBlocker([
    { label: "Client", deletedAt: null },
    { label: "Project", deletedAt: null }
  ])

  expect(blocker).toBeNull()
})

test("names the deleted parent when one is blocking the restore", () => {
  const blocker = resolveRestoreBlocker([
    { label: "Client", deletedAt: null },
    { label: "Project", deletedAt: new Date("2026-05-01T00:00:00.000Z") }
  ])

  expect(blocker).toBe("Project")
})

test("names the outermost deleted parent when several are deleted", () => {
  const blocker = resolveRestoreBlocker([
    { label: "Client", deletedAt: new Date("2026-05-01T00:00:00.000Z") },
    { label: "Project", deletedAt: new Date("2026-05-02T00:00:00.000Z") }
  ])

  expect(blocker).toBe("Client")
})
