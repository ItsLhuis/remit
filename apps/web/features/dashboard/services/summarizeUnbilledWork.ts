const SECONDS_PER_HOUR = 3600

export type UnbilledTimeRow = {
  currency: string
  durationSeconds: number
  hourlyRateSnapshotCents: number
}

export type UnbilledExpenseRow = {
  currency: string
  amountCents: number
  markupPercentage: number | null
}

export type UnbilledWork = {
  timeCents: number
  timeSeconds: number
  timeEntryCount: number
  expenseCents: number
  expenseCount: number
  totalCents: number
}

// Billable work that has been recorded and not yet put on an invoice: the money the freelancer has
// already earned and has not asked for. Time is valued at the rate frozen onto the entry at log
// time (`hourly_rate_snapshot_cents`), never at today's rate, so re-rating a client cannot silently
// restate work already done.
//
// Rounding happens once per row rather than once at the end. A cent is the smallest unit that can
// actually be invoiced, so a row's value has to be a whole number of them before it can be summed;
// summing fractional cents first would produce a total no invoice could be raised for.
export function summarizeUnbilledWork(
  timeRows: readonly UnbilledTimeRow[],
  expenseRows: readonly UnbilledExpenseRow[],
  currency: string
): UnbilledWork {
  let timeCents = 0
  let timeSeconds = 0
  let timeEntryCount = 0

  for (const row of timeRows) {
    if (row.currency !== currency || row.durationSeconds <= 0) continue

    timeCents += Math.round((row.durationSeconds / SECONDS_PER_HOUR) * row.hourlyRateSnapshotCents)
    timeSeconds += row.durationSeconds
    timeEntryCount += 1
  }

  let expenseCents = 0
  let expenseCount = 0

  for (const row of expenseRows) {
    if (row.currency !== currency) continue

    const markup = row.markupPercentage ?? 0

    expenseCents += row.amountCents + Math.round((row.amountCents * markup) / 100)
    expenseCount += 1
  }

  return {
    timeCents,
    timeSeconds,
    timeEntryCount,
    expenseCents,
    expenseCount,
    totalCents: timeCents + expenseCents
  }
}
