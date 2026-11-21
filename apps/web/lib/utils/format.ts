import { toHundredthHours } from "./datetime"

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const

const COMPACT_CURRENCY_THRESHOLD = 10_000

// Intl formatters are cached by option signature rather than constructed per call: building one is
// orders of magnitude more expensive than formatting with it, and these run per row across list
// and dashboard renders. Any new formatter must contribute every option that varies to its cache
// key, or it will silently hand back a formatter configured for a different locale or currency.
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

const numberFormatters = new Map<string, Intl.NumberFormat>()

function getDateTimeFormatter(
  cacheKey: string,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  let formatter = dateTimeFormatters.get(cacheKey)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    dateTimeFormatters.set(cacheKey, formatter)
  }

  return formatter
}

function getNumberFormatter(
  cacheKey: string,
  locale: string | undefined,
  options: Intl.NumberFormatOptions
): Intl.NumberFormat {
  let formatter = numberFormatters.get(cacheKey)

  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options)
    numberFormatters.set(cacheKey, formatter)
  }

  return formatter
}

type FormatDateOptions = {
  locale: string
  timeZone?: string
}

export function formatDate(date: Date, { locale, timeZone }: FormatDateOptions): string {
  return getDateTimeFormatter(`${locale}|${timeZone ?? ""}`, locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone
  }).format(date)
}

// `timeZone` matters for a value that came from a `date` column: Drizzle reads it back as UTC
// midnight, so formatting it in the server's local zone prints the previous day anywhere west of
// Greenwich. Callers holding a calendar day rather than an instant pass "UTC".
export function formatDay(date: Date, locale: string, timeZone?: string): string {
  return getDateTimeFormatter(`day|${locale}|${timeZone ?? ""}`, locale, {
    dateStyle: "medium",
    timeZone
  }).format(date)
}

export function formatIsoDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function formatMonthDay(date: Date, locale: string): string {
  return getDateTimeFormatter(`monthDay|${locale}`, locale, {
    month: "short",
    day: "numeric"
  }).format(date)
}

export function formatMonthShort(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split("-").map(Number)

  return getDateTimeFormatter(`month|${locale}`, locale, { month: "short" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  )
}

export function formatMonthYear(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split("-").map(Number)

  return getDateTimeFormatter(`monthYear|${locale}`, locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function formatCurrency(cents: number, currency: string, locale?: string): string {
  return getNumberFormatter(`currency|${locale ?? ""}|${currency}`, locale, {
    style: "currency",
    currency
  }).format(cents / 100)
}

export function formatCompactNumber(value: number, locale?: string): string {
  return getNumberFormatter(`compactNumber|${locale ?? ""}`, locale, {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value)
}

export function formatCompactCurrency(cents: number, currency: string, locale?: string): string {
  const value = cents / 100
  const compact = Math.abs(value) >= COMPACT_CURRENCY_THRESHOLD

  return getNumberFormatter(`compactCurrency|${locale ?? ""}|${currency}|${compact}`, locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2
  }).format(value)
}

export function formatNumber(value: number, locale?: string): string {
  return getNumberFormatter(`number|${locale ?? ""}`, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

// Takes a value already expressed in percent (20 means 20%) and returns a bare localized number
// with no percent sign — `style: "percent"` would divide by 100 and append the symbol. The sign
// belongs to the caller's translated string, so that ICU controls its placement per locale.
export function formatPercentage(value: number, locale?: string): string {
  return formatNumber(value, locale)
}

// Decimal hours rather than "3h 30m": the value sits in a report column beside money columns a
// reader totals, and a mixed unit cannot be summed by eye or by a spreadsheet. The integer
// hundredths come from `toHundredthHours` so the displayed figure and the exported one round once,
// in the same place.
export function formatHours(seconds: number, locale: string): string {
  return getNumberFormatter(`hours|${locale}`, locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(toHundredthHours(seconds) / 100)
}

export function formatBytes(bytes: number, locale: string): string {
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const fractionDigits = unitIndex === 0 ? 0 : 1
  const formattedValue = getNumberFormatter(`bytes|${locale}|${fractionDigits}`, locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits
  }).format(value)

  return `${formattedValue} ${FILE_SIZE_UNITS[unitIndex]}`
}
