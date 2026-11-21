const DAY_MILLISECONDS = 24 * 60 * 60 * 1000

export type ReportWindow = {
  from: Date | null
  toExclusive: Date | null
}

// The `to` the reader picked is the last day they want included, so it is widened to the instant the
// next day begins and compared with `<`. Comparing `<=` against midnight would silently drop
// everything stamped later that day, which is every timestamp on it.
//
// Windows are computed in UTC, matching how the rows are stored, so an instance in any zone agrees
// about which day a payment or an entry fell on (money-and-dates.md).
export function resolveReportWindow(from: Date | null, to: Date | null): ReportWindow {
  return {
    from,
    toExclusive: to ? new Date(to.getTime() + DAY_MILLISECONDS) : null
  }
}

export function toUtcMonthKey(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`
}
