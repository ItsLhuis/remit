import { beforeEach, expect, test, vi } from "vitest"

import { auditLogs, dataExports, objectDeletions, reportExports } from "@/database/schema"

import { makeDataExport, makeReportExport } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({ deleteObject: vi.fn() }))

vi.mock("@/lib/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/s3")>()),
  storage: { deleteObject: mocks.deleteObject }
}))

// The clock is passed in rather than frozen: freezing timers stalls the postgres driver.
const NOW = new Date("2026-06-15T12:00:00.000Z")
const EXPIRED = new Date("2026-06-08T12:00:00.000Z")
const FRESH = new Date("2026-06-08T12:00:01.000Z")

beforeEach(() => {
  vi.clearAllMocks()

  mocks.deleteObject.mockResolvedValue(undefined)
})

test("removes a data export a week after it finished, with its archive", async () => {
  const { expireDataExports } = await import("../systemWrites")

  await makeDataExport({ status: "ready", completedAt: EXPIRED, storageKey: "old.zip" })
  const fresh = await makeDataExport({ status: "ready", completedAt: FRESH, storageKey: "new.zip" })

  const result = await expireDataExports(NOW)

  const remaining = (await database.select({ id: dataExports.id }).from(dataExports)).map(
    (row) => row.id
  )

  expect(result).toEqual({ rows: 1, storageObjects: 1 })
  expect(remaining).toEqual([fresh.id])
  expect(mocks.deleteObject).toHaveBeenCalledWith("exports", "old.zip")
  expect(await database.select().from(objectDeletions)).toEqual([])
})

test("leaves an export that is still assembling whatever its age", async () => {
  const { expireDataExports } = await import("../systemWrites")

  await makeDataExport({ status: "running", createdAt: EXPIRED })

  const result = await expireDataExports(NOW)

  expect(result.rows).toBe(0)
  expect(await database.select().from(dataExports)).toHaveLength(1)
})

test("records the expiry in the audit log by count", async () => {
  const { expireDataExports } = await import("../systemWrites")

  await makeDataExport({ status: "failed", createdAt: EXPIRED })

  await expireDataExports(NOW)

  const [entry] = await database.select().from(auditLogs)

  expect(entry).toMatchObject({
    event: "data_export.expired",
    metadata: { expiredCount: 1, storageObjects: 0 }
  })
})

test("answers an expired archive as a missing one before the sweep removes it", async () => {
  const { getDataExportArchive } = await import("../queries")

  const expired = await makeDataExport({
    status: "ready",
    completedAt: new Date(Date.now() - 8 * 86_400_000),
    storageKey: "old.zip",
    filename: "old.zip"
  })

  expect(await getDataExportArchive({ exportId: expired.id })).toBeNull()
})

test("removes a report PDF a week after it was rendered, with its object", async () => {
  const { expireReportExports } = await import("@/features/reports/systemWrites")

  await makeReportExport({ status: "ready", completedAt: EXPIRED, storageKey: "report.pdf" })

  const result = await expireReportExports(NOW)

  expect(result).toEqual({ rows: 1, storageObjects: 1 })
  expect(await database.select().from(reportExports)).toEqual([])
  expect(mocks.deleteObject).toHaveBeenCalledWith("exports", "report.pdf")
})
