import { describe, expect, test } from "vitest"

import { isActiveDataExportStatus, toDataExportFailureReason } from "../exportStatus"

describe("isActiveDataExportStatus", () => {
  test("treats a queued export as active", () => {
    expect(isActiveDataExportStatus("pending")).toBe(true)
  })

  test("treats an assembling export as active", () => {
    expect(isActiveDataExportStatus("running")).toBe(true)
  })

  test("treats a finished export as inactive", () => {
    expect(isActiveDataExportStatus("ready")).toBe(false)
    expect(isActiveDataExportStatus("failed")).toBe(false)
  })
})

describe("toDataExportFailureReason", () => {
  test("returns a known reason unchanged", () => {
    expect(toDataExportFailureReason("storageFailed")).toBe("storageFailed")
  })

  test("returns null for an unrecognised stored value", () => {
    expect(toDataExportFailureReason("ECONNREFUSED 127.0.0.1:9000")).toBeNull()
  })

  test("returns null when no reason was recorded", () => {
    expect(toDataExportFailureReason(null)).toBeNull()
  })
})
