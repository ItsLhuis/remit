import { describe, expect, test } from "vitest"

import { fromDateTimeLocalValue, toDateTimeLocalValue } from "../datetime"

// Both helpers are defined in terms of the host's local zone, so assertions are written as
// round-trips and as zone-independent invariants rather than against fixed wall-clock strings, which
// would only hold on a machine pinned to one offset.
describe("toDateTimeLocalValue", () => {
  test("produces a value the datetime-local control accepts", () => {
    const result = toDateTimeLocalValue("2026-08-05T09:30:00.000Z")

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  test("returns an empty value for an unparseable instant", () => {
    const result = toDateTimeLocalValue("not an instant")

    expect(result).toBe("")
  })

  test("returns an empty value for an empty instant", () => {
    const result = toDateTimeLocalValue("")

    expect(result).toBe("")
  })
})

describe("fromDateTimeLocalValue", () => {
  test("returns an ISO instant for a well-formed local value", () => {
    const result = fromDateTimeLocalValue("2026-08-05T09:30")

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  test("returns null for a value the control never produces", () => {
    const result = fromDateTimeLocalValue("05/08/2026 09:30")

    expect(result).toBeNull()
  })

  test("returns null for a well-formed value that is not a real date", () => {
    const result = fromDateTimeLocalValue("2026-02-30T09:30")

    expect(result).toBeNull()
  })

  test("returns null for an empty value", () => {
    const result = fromDateTimeLocalValue("")

    expect(result).toBeNull()
  })
})

describe("datetime round trip", () => {
  test.each(["2026-08-05T09:30:00.000Z", "2026-01-01T00:00:00.000Z", "2026-12-31T23:59:00.000Z"])(
    "preserves the instant %s across a local round trip",
    (instant) => {
      const result = fromDateTimeLocalValue(toDateTimeLocalValue(instant))

      expect(result).toBe(instant)
    }
  )
})
