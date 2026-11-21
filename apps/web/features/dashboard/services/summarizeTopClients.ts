const TOP_CLIENT_LIMIT = 5

export type ClientRevenueRow = {
  clientId: string
  clientName: string
  currency: string
  amountCents: number
}

export type TopClient = {
  clientId: string
  name: string
  revenueCents: number
  sharePercentage: number
}

// Narrowed to one currency before ranking. Clients billed in different currencies cannot be ordered
// against each other without an exchange rate the instance does not hold, so a client outside the
// dashboard's primary currency is absent rather than converted at an invented rate.
//
// `sharePercentage` is a ratio of the shown population, not money, which is why it is the one value
// here that is not integer cents; it is rounded to a tenth so the rendered percentages do not
// wander with floating-point noise.
export function summarizeTopClients(
  rows: readonly ClientRevenueRow[],
  currency: string,
  limit = TOP_CLIENT_LIMIT
): TopClient[] {
  const totals = new Map<string, { name: string; revenueCents: number }>()

  let totalCents = 0

  for (const row of rows) {
    if (row.currency !== currency) continue

    const existing = totals.get(row.clientId)

    totals.set(row.clientId, {
      name: row.clientName,
      revenueCents: (existing?.revenueCents ?? 0) + row.amountCents
    })

    totalCents += row.amountCents
  }

  return Array.from(totals.entries())
    .map(([clientId, entry]) => ({
      clientId,
      name: entry.name,
      revenueCents: entry.revenueCents,
      sharePercentage:
        totalCents === 0 ? 0 : Math.round((entry.revenueCents / totalCents) * 1000) / 10
    }))
    .sort((first, second) => second.revenueCents - first.revenueCents)
    .slice(0, limit)
}
