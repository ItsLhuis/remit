import { expect, test } from "vitest"

import { formatReportCell } from "../formatReportCell"

test("prints a money cell with the currency the row was grouped under", () => {
  expect(formatReportCell({ kind: "money", cents: 123_456 }, "EUR", "en")).toBe("€1,234.56")
})

test("prints a duration cell as decimal hours so it can be summed beside money", () => {
  expect(formatReportCell({ kind: "duration", seconds: 5_400 }, "EUR", "en")).toBe("1.50")
})

test("prints a count cell as a plain number", () => {
  expect(formatReportCell({ kind: "count", value: 1_234 }, "EUR", "en")).toBe("1,234")
})

test("prints nothing for a column a report does not fill", () => {
  expect(formatReportCell(undefined, "EUR", "en")).toBe("")
})
