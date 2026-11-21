import { calculateEntryAmountCents } from "./timeEntryDuration"

export type TimeEntryAggregateRow = {
  durationSeconds: number | null
  billable: boolean
  invoicedInId: string | null
  hourlyRateSnapshotCents: number
  currency: string
}

export type BillableHoursAggregate = {
  totalSeconds: number
  billableSeconds: number
  unbilledSeconds: number
  unbilledAmountCentsByCurrency: Record<string, number>
}

// Amounts bucket by currency instead of collapsing to one number. A project carries its own
// currency override, so a freelancer working in two of them has two unrelated receivables, and
// adding their cents together would produce a figure that means nothing.
export function aggregateBillableHours(rows: TimeEntryAggregateRow[]): BillableHoursAggregate {
  const aggregate: BillableHoursAggregate = {
    totalSeconds: 0,
    billableSeconds: 0,
    unbilledSeconds: 0,
    unbilledAmountCentsByCurrency: {}
  }

  for (const row of rows) {
    const durationSeconds = row.durationSeconds ?? 0

    aggregate.totalSeconds += durationSeconds

    if (!row.billable) continue

    aggregate.billableSeconds += durationSeconds

    if (row.invoicedInId !== null) continue

    aggregate.unbilledSeconds += durationSeconds

    const amountCents = calculateEntryAmountCents(durationSeconds, row.hourlyRateSnapshotCents)

    aggregate.unbilledAmountCentsByCurrency[row.currency] =
      (aggregate.unbilledAmountCentsByCurrency[row.currency] ?? 0) + amountCents
  }

  return aggregate
}
