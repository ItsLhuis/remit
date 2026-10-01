import { describe, expect, test } from "vitest"

import { MINIMUM_PART_BYTES, MULTIPART_THRESHOLD_BYTES, planMultipartUpload } from "../multipart"

const MiB = 1024 * 1024

describe("planMultipartUpload", () => {
  test("sends an archive at or under the threshold in one request", () => {
    expect(planMultipartUpload(MULTIPART_THRESHOLD_BYTES)).toEqual({ kind: "single" })
  })

  test("splits a larger archive into equal parts with a shorter last one", () => {
    const plan = planMultipartUpload(MULTIPART_THRESHOLD_BYTES + 1)

    expect(plan.kind).toBe("multipart")

    if (plan.kind !== "multipart") return

    expect(plan.partSize).toBe(64 * MiB)
    expect(plan.partCount).toBe(Math.ceil((MULTIPART_THRESHOLD_BYTES + 1) / (64 * MiB)))
  })

  test("grows the part size so an archive of any size fits in S3's ten thousand parts", () => {
    const size = 2 * 1024 * 1024 * MiB

    const plan = planMultipartUpload(size)

    if (plan.kind !== "multipart") throw new Error("expected a multipart plan")

    expect(plan.partCount).toBeLessThanOrEqual(10_000)
    expect(plan.partSize * plan.partCount).toBeGreaterThanOrEqual(size)
  })

  test("never plans a part below the provider minimum, whatever threshold a caller sets", () => {
    const plan = planMultipartUpload(12 * MiB, { thresholdBytes: 1 })

    if (plan.kind !== "multipart") throw new Error("expected a multipart plan")

    expect(plan.partSize).toBeGreaterThanOrEqual(MINIMUM_PART_BYTES)
    expect(plan.partCount).toBe(Math.ceil((12 * MiB) / plan.partSize))
  })
})
