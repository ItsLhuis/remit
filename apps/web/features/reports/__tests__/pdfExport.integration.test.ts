import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, reportExports } from "@/database/schema"

import { makeClient, makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  enqueueJob: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn()
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

// The queue is stubbed at the module boundary: this path's job is to persist the row and hand the id
// over, and the render it triggers is exercised in `pdfRenderJob.integration.test.ts`.
vi.mock("@/lib/jobs", () => ({
  enqueueJob: mocks.enqueueJob,
  registerJobHandler: vi.fn()
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-0000000006a1"

describe("requestReportPdf", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: "owner-report@example.com", name: "Ada Owner" })

    mocks.headers.mockResolvedValue(
      new Headers({ "user-agent": "Vitest", "x-forwarded-for": "203.0.113.9" })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, name: "Ada Owner" } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("queues a render and records the request without any of the report's rows", async () => {
    const { requestReportPdf } = await import("../pdfExport")

    const result = await requestReportPdf({
      report: "revenueByClient",
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-03-31T00:00:00.000Z"),
      clientId: null,
      projectId: null,
      taxRateId: null
    })

    if ("error" in result) throw new Error(`Expected success, got ${result.error}`)

    const [row] = await database.select().from(reportExports)
    const [entry] = await database.select().from(auditLogs)

    expect(row).toEqual(
      expect.objectContaining({
        report: "revenueByClient",
        status: "pending",
        requestedByUserId: ownerId,
        storageKey: null
      })
    )
    expect(row?.filters).toEqual(
      expect.objectContaining({ from: "2026-01-01T00:00:00.000Z", clientId: null })
    )
    expect(entry).toEqual(
      expect.objectContaining({
        event: "report.pdf_export.requested",
        actorUserId: ownerId,
        targetEntityType: "report_export",
        ipAddress: "203.0.113.9"
      })
    )
    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      "report.pdf.render",
      { reportExportId: result.data.id },
      { jobId: `report.pdf.render.${result.data.id}` }
    )
  })

  test("drops a filter the requested report does not offer before persisting it", async () => {
    const client = await makeClient({ name: "Aurora" })

    const { requestReportPdf } = await import("../pdfExport")

    const result = await requestReportPdf({
      report: "taxSummary",
      from: null,
      to: null,
      clientId: client.id,
      projectId: null,
      taxRateId: null
    })

    if ("error" in result) throw new Error(`Expected success, got ${result.error}`)

    const [row] = await database.select().from(reportExports)

    expect(row?.filters).toEqual(expect.objectContaining({ clientId: null }))
  })

  test("refuses a role that may not export and queues nothing", async () => {
    mocks.getCurrentRole.mockResolvedValue("assistant")

    const { requestReportPdf } = await import("../pdfExport")

    const result = await requestReportPdf({
      report: "revenueByClient",
      from: null,
      to: null,
      clientId: null,
      projectId: null,
      taxRateId: null
    })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await database.select().from(reportExports)).toEqual([])
    expect(mocks.enqueueJob).not.toHaveBeenCalled()
  })

  test("refuses an anonymous caller", async () => {
    mocks.getSession.mockResolvedValue(null)

    const { requestReportPdf } = await import("../pdfExport")

    const result = await requestReportPdf({
      report: "revenueByClient",
      from: null,
      to: null,
      clientId: null,
      projectId: null,
      taxRateId: null
    })

    expect(result).toEqual({ error: expect.any(String) })
    expect(mocks.enqueueJob).not.toHaveBeenCalled()
  })
})

describe("getReportPdfState", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: "owner-report@example.com", name: "Ada Owner" })

    mocks.headers.mockResolvedValue(new Headers())
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, name: "Ada Owner" } })
    mocks.getCurrentRole.mockResolvedValue("accountant")
  })

  test("hands back a download path only once the artifact exists", async () => {
    const { makeReportExport } = await import("@/tests/factories")
    const { getReportPdfState } = await import("../pdfExport")

    const pending = await makeReportExport()
    const ready = await makeReportExport({
      status: "ready",
      storageKey: "report-exports/key/report.pdf"
    })

    const pendingState = await getReportPdfState({ id: pending.id })
    const readyState = await getReportPdfState({ id: ready.id })

    if ("error" in pendingState || "error" in readyState)
      throw new Error("Expected both to resolve")

    expect(pendingState.data.downloadPath).toBeNull()
    expect(readyState.data.downloadPath).toBe(`/api/report-exports/${ready.id}`)
  })

  test("refuses a role that may not export", async () => {
    mocks.getCurrentRole.mockResolvedValue("assistant")

    const { makeReportExport } = await import("@/tests/factories")
    const { getReportPdfState } = await import("../pdfExport")

    const row = await makeReportExport()

    expect(await getReportPdfState({ id: row.id })).toEqual({ error: expect.any(String) })
  })
})
