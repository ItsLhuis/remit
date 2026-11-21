// @vitest-environment node

import { beforeEach, expect, test, vi } from "vitest"

import { warnAboutMigrationDrift } from "../startupChecks"

const mocks = vi.hoisted(() => ({
  getMigrationDrift: vi.fn(),
  warn: vi.fn()
}))

vi.mock("@/lib/logger", () => ({ logger: { warn: mocks.warn } }))

vi.mock("../queries", () => ({ getMigrationDrift: mocks.getMigrationDrift }))

beforeEach(() => {
  vi.clearAllMocks()
})

test("says nothing when the database is up to date", async () => {
  mocks.getMigrationDrift.mockResolvedValue({
    drift: "healthy",
    appliedCount: 11,
    expectedCount: 11
  })

  await warnAboutMigrationDrift()

  expect(mocks.warn).not.toHaveBeenCalled()
})

test("names how many migrations are pending when the database is behind", async () => {
  mocks.getMigrationDrift.mockResolvedValue({
    drift: "pending",
    appliedCount: 6,
    expectedCount: 11
  })

  await warnAboutMigrationDrift()

  expect(mocks.warn).toHaveBeenCalledWith(
    expect.objectContaining({ appliedCount: 6, expectedCount: 11 }),
    expect.stringContaining("5 pending")
  )
})

test("warns about a database ahead of the build rather than telling anyone to migrate", async () => {
  mocks.getMigrationDrift.mockResolvedValue({ drift: "ahead", appliedCount: 12, expectedCount: 11 })

  await warnAboutMigrationDrift()

  expect(mocks.warn).toHaveBeenCalledWith(
    expect.objectContaining({ appliedCount: 12 }),
    expect.stringContaining("does not know about")
  )
})

test("warns instead of throwing when the database cannot be reached", async () => {
  mocks.getMigrationDrift.mockRejectedValue(new Error("ECONNREFUSED"))

  await expect(warnAboutMigrationDrift()).resolves.toBeUndefined()

  expect(mocks.warn).toHaveBeenCalledWith(
    expect.objectContaining({ err: expect.any(Error) }),
    expect.stringContaining("Could not check")
  )
})
