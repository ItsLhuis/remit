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

export function formatCurrency(cents: number, currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency
  }).format(cents / 100)
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
