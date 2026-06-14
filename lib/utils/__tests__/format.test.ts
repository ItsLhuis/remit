import { describe, expect, test } from "vitest"

import {
  formatCompactCurrency,
  formatCompactNumber,
  formatDay,
  formatMonthShort,
  formatPercentage
} from "../format"

process.env.TZ = "UTC"

describe("formatCompactNumber", () => {
  test("returns the plain value when below one thousand", () => {
    expect(formatCompactNumber(100, "en-US")).toBe("100")
  })

  test("abbreviates thousands with a single fraction digit", () => {
    expect(formatCompactNumber(1500, "en-US")).toBe("1.5K")
  })

  test("abbreviates millions", () => {
    expect(formatCompactNumber(1_000_000, "en-US")).toBe("1M")
  })

  test("returns zero unchanged", () => {
    expect(formatCompactNumber(0, "en-US")).toBe("0")
  })
})

describe("formatCompactCurrency", () => {
  test("keeps exact cents when the value is below the compact threshold", () => {
    expect(formatCompactCurrency(123450, "USD", "en-US")).toBe("$1,234.50")
  })

  test("abbreviates at the compact threshold", () => {
    expect(formatCompactCurrency(1000000, "USD", "en-US")).toBe("$10K")
  })

  test("abbreviates hundreds of thousands", () => {
    expect(formatCompactCurrency(10000000, "USD", "en-US")).toBe("$100K")
  })

  test("abbreviates millions with a single fraction digit", () => {
    expect(formatCompactCurrency(123456789, "USD", "en-US")).toBe("$1.2M")
  })
})

describe("formatDay", () => {
  test("formats a date as a medium-style day", () => {
    expect(formatDay(new Date(Date.UTC(2026, 0, 15)), "en-US")).toBe("Jan 15, 2026")
  })

  test("respects the requested locale", () => {
    expect(formatDay(new Date(Date.UTC(2026, 0, 15)), "en-GB")).toBe("15 Jan 2026")
  })
})

describe("formatMonthShort", () => {
  test("formats a year-month key as a short month name", () => {
    expect(formatMonthShort("2026-03", "en-US")).toBe("Mar")
  })

  test("formats the first month of the year", () => {
    expect(formatMonthShort("2026-01", "en-US")).toBe("Jan")
  })

  test("respects the requested locale", () => {
    expect(formatMonthShort("2026-05", "es-ES")).toBe("may")
  })
})

describe("formatPercentage", () => {
  test("formats a whole number without fraction digits", () => {
    expect(formatPercentage(20, "en-US")).toBe("20")
  })

  test("keeps up to two decimal places", () => {
    expect(formatPercentage(7.5, "en-US")).toBe("7.5")
  })

  test("trims trailing precision beyond two decimals", () => {
    expect(formatPercentage(23.456, "en-US")).toBe("23.46")
  })
})
