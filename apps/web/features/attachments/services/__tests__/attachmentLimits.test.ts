import { describe, expect, test } from "vitest"

import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_RECORD,
  ATTACHMENT_MAX_TOTAL_BYTES
} from "../../schemas"
import { checkAttachmentLimits } from "../attachmentLimits"

function sizes(count: number, sizeBytes: number): { sizeBytes: number }[] {
  return Array.from({ length: count }, () => ({ sizeBytes }))
}

describe("checkAttachmentLimits", () => {
  test("allows the first attachment on an empty record", () => {
    const result = checkAttachmentLimits([], { sizeBytes: 1024 })

    expect(result).toEqual({ allowed: true })
  })

  test("allows an attachment that lands exactly on the count ceiling", () => {
    const result = checkAttachmentLimits(sizes(ATTACHMENT_MAX_PER_RECORD - 1, 1024), {
      sizeBytes: 1024
    })

    expect(result).toEqual({ allowed: true })
  })

  test("refuses on count when the record already holds the maximum", () => {
    const result = checkAttachmentLimits(sizes(ATTACHMENT_MAX_PER_RECORD, 1024), {
      sizeBytes: 1024
    })

    expect(result).toEqual({ allowed: false, reason: "count" })
  })

  test("allows an attachment that lands exactly on the total-bytes ceiling", () => {
    const existing = [{ sizeBytes: ATTACHMENT_MAX_TOTAL_BYTES - 1024 }]

    const result = checkAttachmentLimits(existing, { sizeBytes: 1024 })

    expect(result).toEqual({ allowed: true })
  })

  test("refuses on total bytes when one more byte would exceed the ceiling", () => {
    const existing = [{ sizeBytes: ATTACHMENT_MAX_TOTAL_BYTES - 1024 }]

    const result = checkAttachmentLimits(existing, { sizeBytes: 1025 })

    expect(result).toEqual({ allowed: false, reason: "totalBytes" })
  })

  // The two ceilings bind independently, and this is the case that proves it: four files at the
  // per-file maximum are nowhere near the count limit but are already past the record's byte budget.
  test("refuses on total bytes while the count ceiling is still far away", () => {
    const existing = sizes(4, ATTACHMENT_MAX_BYTES)

    const result = checkAttachmentLimits(existing, { sizeBytes: 1024 })

    expect(existing.length).toBeLessThan(ATTACHMENT_MAX_PER_RECORD)
    expect(result).toEqual({ allowed: false, reason: "totalBytes" })
  })

  // Count is checked before bytes, so a record full of tiny files reports the limit the user can act
  // on rather than one they have not reached.
  test("reports count rather than bytes when a full record receives a tiny file", () => {
    const result = checkAttachmentLimits(sizes(ATTACHMENT_MAX_PER_RECORD, 1), { sizeBytes: 1 })

    expect(result).toEqual({ allowed: false, reason: "count" })
  })
})
