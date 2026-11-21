import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, reportExports } from "@/database/schema"

import { makeClient, makeInvoice, makeReportExport, makeSettings } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
  putExportObject: vi.fn(),
  renderHtmlToPdf: vi.fn()
}))

// Chromium and object storage are the two IO edges of this job and both are stubbed at the module
// boundary: what is under test is the claim, the document that reaches the renderer, and the row the
// job leaves behind.
vi.mock("@/lib/pdf", () => ({
  renderHtmlToPdf: mocks.renderHtmlToPdf
}))

vi.mock("@/lib/storage/s3", () => ({
  putExportObject: mocks.putExportObject
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

describe("renderReportPdf", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    mocks.renderHtmlToPdf.mockResolvedValue(Buffer.from("%PDF-1.4 rendered"))
    mocks.putExportObject.mockResolvedValue(undefined)

    await makeSettings({ defaultLocale: "en", defaultTimezone: "UTC", businessName: "Aurora" })
  })

  test("renders the requested report and leaves a downloadable row behind", async () => {
    const client = await makeClient({ name: "Aurora Client" })

    await makeInvoice({
      clientId: client.id,
      status: "sent",
      issueDate: new Date("2026-03-15T00:00:00.000Z"),
      totalCents: 100_000
    })

    const requested = await makeReportExport()

    const { renderReportPdf } = await import("../pdfRenderJob")

    await renderReportPdf({ reportExportId: requested.id })

    const [row] = await database.select().from(reportExports)

    expect(row).toEqual(
      expect.objectContaining({ status: "ready", storageKey: expect.any(String) })
    )
    expect(row?.completedAt).not.toBeNull()
    expect(mocks.renderHtmlToPdf).toHaveBeenCalledTimes(1)

    const rendered = mocks.renderHtmlToPdf.mock.calls[0]?.[0] as { html: string }

    expect(rendered.html).toContain("Aurora Client")
    expect(rendered.html).toContain("Aurora")
  })

  test("ignores a second delivery of the same job rather than rendering twice", async () => {
    const requested = await makeReportExport()

    const { renderReportPdf } = await import("../pdfRenderJob")

    await renderReportPdf({ reportExportId: requested.id })
    await renderReportPdf({ reportExportId: requested.id })

    expect(mocks.renderHtmlToPdf).toHaveBeenCalledTimes(1)
  })

  test("records a stable reason and audits the failure when storage refuses the file", async () => {
    mocks.putExportObject.mockRejectedValue(new Error("bucket unreachable"))

    const requested = await makeReportExport()

    const { renderReportPdf } = await import("../pdfRenderJob")

    await renderReportPdf({ reportExportId: requested.id })

    const [row] = await database.select().from(reportExports)
    const entries = await database.select().from(auditLogs)

    expect(row).toEqual(
      expect.objectContaining({ status: "failed", failureReason: "storageFailed" })
    )
    expect(entries.map((entry) => entry.event)).toContain("report.pdf_export.failed")
  })

  test("fails the row rather than the job when the stored query cannot be read", async () => {
    const requested = await makeReportExport({ report: "notAReport" })

    const { renderReportPdf } = await import("../pdfRenderJob")

    await renderReportPdf({ reportExportId: requested.id })

    const [row] = await database.select().from(reportExports)

    expect(row).toEqual(
      expect.objectContaining({ status: "failed", failureReason: "renderFailed" })
    )
    expect(mocks.renderHtmlToPdf).not.toHaveBeenCalled()
  })
})
