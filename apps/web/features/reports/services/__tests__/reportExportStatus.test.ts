import { expect, test } from "vitest"

import { isActiveReportExportStatus, toReportExportFailureReason } from "../reportExportStatus"

test("treats a queued and a running export as still in flight", () => {
  expect(isActiveReportExportStatus("pending")).toBe(true)
  expect(isActiveReportExportStatus("running")).toBe(true)
})

test("treats a finished and a failed export as no longer in flight", () => {
  expect(isActiveReportExportStatus("ready")).toBe(false)
  expect(isActiveReportExportStatus("failed")).toBe(false)
})

test("returns a recognised failure reason unchanged", () => {
  expect(toReportExportFailureReason("storageFailed")).toBe("storageFailed")
})

test("collapses an unrecognised reason to null rather than passing it on as a key", () => {
  expect(toReportExportFailureReason("something-an-older-build-wrote")).toBeNull()
  expect(toReportExportFailureReason(null)).toBeNull()
})
