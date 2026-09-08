import { expect, test } from "vitest"

import {
  buildReportExportDownloadPath,
  buildReportExportFilename,
  buildReportExportStorageKey
} from "../reportFilename"

const EXPORTED_AT = new Date("2026-03-31T22:45:00.000Z")

test("names a downloaded file after the report and the day it was produced", () => {
  expect(buildReportExportFilename("revenueByClient", EXPORTED_AT, "csv")).toBe(
    "revenue-by-client-2026-03-31.csv"
  )
})

test("uses the same name for a PDF as for the CSV of the same report", () => {
  expect(buildReportExportFilename("taxSummary", EXPORTED_AT, "pdf")).toBe(
    "tax-summary-2026-03-31.pdf"
  )
})

test("keys the stored object by the export id so two runs cannot overwrite each other", () => {
  const first = buildReportExportStorageKey("11111111-1111-4111-8111-111111111111", "report.pdf")
  const second = buildReportExportStorageKey("22222222-2222-4222-8222-222222222222", "report.pdf")

  expect(first).not.toBe(second)
  expect(first).toContain("11111111-1111-4111-8111-111111111111")
})

test("points a download at the credentialed route rather than at storage", () => {
  expect(buildReportExportDownloadPath("11111111-1111-4111-8111-111111111111")).toBe(
    "/api/report-exports/11111111-1111-4111-8111-111111111111"
  )
})
