import { describe, expect, test } from "vitest"

import { escapeCsvValue, serializeCsv } from "../csv"

// A minimal RFC 4180 reader, deliberately written from the specification rather than from the
// serializer it checks: a round trip through a parser that shared the serializer's assumptions would
// agree with any consistent mistake. This is the only place the export's correctness is decided, so
// it must not be replaced by re-splitting on "," and "\r\n".
function readQuotedField(csv: string, start: number): { value: string; next: number } {
  let value = ""
  let index = start

  while (index < csv.length) {
    if (csv[index] !== '"') {
      value += csv[index]
      index += 1

      continue
    }

    if (csv[index + 1] !== '"') return { value, next: index + 1 }

    value += '"'
    index += 2
  }

  return { value, next: index }
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = []

  let row: string[] = []
  let field = ""
  let index = 0

  while (index < csv.length) {
    const character = csv[index]

    if (character === '"') {
      const quoted = readQuotedField(csv, index + 1)

      field += quoted.value
      index = quoted.next

      continue
    }

    if (character === ",") {
      row.push(field)
      field = ""
      index += 1

      continue
    }

    if (character === "\r" && csv[index + 1] === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      index += 2

      continue
    }

    field += character
    index += 1
  }

  row.push(field)
  rows.push(row)

  return rows
}

describe("escapeCsvValue", () => {
  test("leaves a plain value unquoted", () => {
    expect(escapeCsvValue("Office chair")).toBe("Office chair")
  })

  test("quotes a value containing a comma", () => {
    expect(escapeCsvValue("Chair, desk and lamp")).toBe('"Chair, desk and lamp"')
  })

  test("doubles embedded quotes and wraps the value", () => {
    expect(escapeCsvValue('He said "urgent"')).toBe('"He said ""urgent"""')
  })

  test("quotes a value containing a newline", () => {
    expect(escapeCsvValue("Line one\nLine two")).toBe('"Line one\nLine two"')
  })

  test("quotes a value containing a carriage return", () => {
    expect(escapeCsvValue("Line one\rLine two")).toBe('"Line one\rLine two"')
  })

  test("quotes a value containing a CRLF pair", () => {
    expect(escapeCsvValue("Line one\r\nLine two")).toBe('"Line one\r\nLine two"')
  })

  test("renders null and undefined as an empty field", () => {
    expect(escapeCsvValue(null)).toBe("")
    expect(escapeCsvValue(undefined)).toBe("")
  })

  test("defuses a string a spreadsheet would evaluate as a formula", () => {
    expect(escapeCsvValue("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)")
    expect(escapeCsvValue('=HYPERLINK("http://evil.test","Click")')).toBe(
      `"'=HYPERLINK(""http://evil.test"",""Click"")"`
    )
  })

  test("defuses every leading character a spreadsheet treats as a formula", () => {
    for (const prefix of ["=", "+", "-", "@", "\t", "\r"]) {
      expect(escapeCsvValue(`${prefix}cmd`).replace(/^"|"$/g, "")).toBe(`'${prefix}cmd`)
    }
  })

  // The counterpart to the rule above, and the reason it is restricted to strings: a negative amount
  // must stay a number the spreadsheet can sum.
  test("leaves a negative number numeric rather than defusing it", () => {
    expect(escapeCsvValue(-1250)).toBe("-1250")
    expect(escapeCsvValue(-12.5)).toBe("-12.5")
  })

  test("leaves a string that merely contains a formula character alone", () => {
    expect(escapeCsvValue("Rate x2 = agreed")).toBe("Rate x2 = agreed")
  })

  test("renders a date as an ISO instant", () => {
    expect(escapeCsvValue(new Date("2026-08-06T00:00:00.000Z"))).toBe("2026-08-06T00:00:00.000Z")
  })

  test("renders numbers, bigints and booleans without quoting", () => {
    expect(escapeCsvValue(1250)).toBe("1250")
    expect(escapeCsvValue(BigInt(1250))).toBe("1250")
    expect(escapeCsvValue(true)).toBe("true")
  })
})

describe("serializeCsv", () => {
  test("separates records with CRLF and fields with commas", () => {
    const csv = serializeCsv([
      ["Date", "Amount"],
      ["2026-08-06", "12.50"]
    ])

    expect(csv).toBe("Date,Amount\r\n2026-08-06,12.50")
  })

  // Round-tripping is exact for every value a spreadsheet would not evaluate, which is the contract
  // downstream readers depend on. The formula guard is the one deliberate exception, pinned below so
  // the difference reads as a decision rather than as a bug in the escaper.
  test("round-trips every CSV-special character back to the source values", () => {
    const source = [
      ["Date", "Description", "Amount"],
      ["2026-08-06", 'Chair, desk and "urgent" lamp', "120.00"],
      ["2026-08-07", "Line one\nLine two", "8.20"],
      ["2026-08-08", "Line one\r\nLine two", "0.00"],
      ["2026-08-09", 'Trailing quote "', "1.00"],
      ["2026-08-10", "", "2.00"]
    ]

    const parsed = parseCsv(serializeCsv(source))

    expect(parsed).toEqual(source)
  })

  test("keeps a value that is only a comma in its own column", () => {
    const parsed = parseCsv(serializeCsv([[",", "after"]]))

    expect(parsed).toEqual([[",", "after"]])
  })

  test("round-trips a formula-leading value to its defused form, in one column", () => {
    const parsed = parseCsv(serializeCsv([["=1+1", "after"]]))

    expect(parsed).toEqual([["'=1+1", "after"]])
  })
})
