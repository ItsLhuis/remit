const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

// Both helpers deliberately read and write the *browser's* zone, which is why they are only ever
// called from client components. A `datetime-local` control has no zone of its own, so the instant a
// user means by "09:00" is only recoverable where they typed it; resolving it on the server would
// silently reinterpret it in the server's zone. Everything crossing the trust boundary afterwards is
// an ISO instant, and every window and next-run calculation stays explicit UTC (money-and-dates.md).
export function toDateTimeLocalValue(isoInstant: string): string {
  const date = new Date(isoInstant)

  if (Number.isNaN(date.getTime())) return ""

  const pad = (value: number) => String(value).padStart(2, "0")

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateTimeLocalValue(value: string): string | null {
  if (!DATE_TIME_LOCAL_PATTERN.test(value)) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return null

  // `new Date("2026-02-30T09:30")` rolls forward to 2 March rather than failing, so a well-formed
  // but impossible date would otherwise come back as a silently different instant. Comparing the
  // round trip is what turns that into a rejection.
  if (toDateTimeLocalValue(date.toISOString()) !== value) return null

  return date.toISOString()
}
