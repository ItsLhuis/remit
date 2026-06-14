const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const

type FormatDateOptions = {
  locale: string
  timeZone?: string
}

export function formatDate(date: Date, { locale, timeZone }: FormatDateOptions): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone
  }).format(date)
}

export function formatDay(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date)
}

export function formatMonthShort(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split("-").map(Number)

  return new Intl.DateTimeFormat(locale, { month: "short" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  )
}

export function formatCurrency(cents: number, currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency
  }).format(cents / 100)
}

const COMPACT_CURRENCY_THRESHOLD = 10_000

export function formatCompactNumber(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value)
}

export function formatCompactCurrency(cents: number, currency: string, locale?: string): string {
  const value = cents / 100
  const compact = Math.abs(value) >= COMPACT_CURRENCY_THRESHOLD

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2
  }).format(value)
}

export function formatPercentage(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
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
  const formattedValue = new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits
  }).format(value)

  return `${formattedValue} ${FILE_SIZE_UNITS[unitIndex]}`
}
