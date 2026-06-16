const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

export function isValidAmount(value: string): boolean {
  const normalized = value.trim()

  return normalized === "" || AMOUNT_PATTERN.test(normalized)
}

export function parseAmountToCents(value: string): number | null {
  const normalized = value.trim()

  if (!AMOUNT_PATTERN.test(normalized)) return null

  const [whole, fraction = ""] = normalized.split(".")
  const fractionCents = Number(`${fraction}00`.slice(0, 2))

  return Number(whole) * 100 + fractionCents
}

export function formatCentsForInput(cents: number | null): string {
  if (cents === null) return ""

  const sign = cents < 0 ? "-" : ""
  const absolute = Math.abs(cents)
  const whole = Math.floor(absolute / 100)
  const fraction = absolute % 100

  return `${sign}${whole}.${String(fraction).padStart(2, "0")}`
}
