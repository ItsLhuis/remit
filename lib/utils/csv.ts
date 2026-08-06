// RFC 4180 quoting. A value is wrapped in quotes only when it contains a delimiter, a quote, or a
// line break, and an embedded quote is doubled. `\r` belongs in that set as much as `\n` does: a
// lone carriage return pasted from a spreadsheet ends a record for most parsers, so leaving it
// unquoted silently splits one row into two and shifts every later column.
const CSV_SPECIAL_PATTERN = /[",\r\n]/

// CRLF, not LF: RFC 4180 defines it as the record separator, and it is what Excel writes.
const CSV_RECORD_SEPARATOR = "\r\n"

// Excel and LibreOffice evaluate a cell that opens with one of these as a formula, so a description
// or a client name reading `=HYPERLINK(...)` becomes code the moment an accountant opens the export.
// Quoting does not prevent it — the spreadsheet strips the quotes before evaluating — so the leading
// character has to stop being leading.
const CSV_FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/

// Applied to strings only, and that restriction is the point: `String(-1250)` also opens with `-`,
// and prefixing a number would turn every negative amount into text a spreadsheet cannot sum, which
// is the one thing the export exists for. Numbers, dates and booleans are never formulas.
function neutralizeFormula(text: string): string {
  return CSV_FORMULA_PREFIX_PATTERN.test(text) ? `'${text}` : text
}

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ""

  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? neutralizeFormula(value)
        : typeof value === "number" || typeof value === "boolean" || typeof value === "bigint"
          ? String(value)
          : JSON.stringify(value)

  if (CSV_SPECIAL_PATTERN.test(text)) return `"${text.replace(/"/g, '""')}"`

  return text
}

export function serializeCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join(CSV_RECORD_SEPARATOR)
}

export function downloadCsv(csv: string, filename: string): void {
  if (typeof document === "undefined") return

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}
