const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const

const COMPACT_CURRENCY_THRESHOLD = 10_000

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

export function formatDay(date: Date, locale: string): string {
  return getDateTimeFormatter(`day|${locale}`, locale, { dateStyle: "medium" }).format(date)
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

export function formatPercentage(value: number, locale?: string): string {
  return getNumberFormatter(`percentage|${locale ?? ""}`, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
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
