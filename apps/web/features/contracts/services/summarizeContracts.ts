import { type ContractStatus } from "../schemas"

import { resolveContractDisplayStatus } from "./contractExpiry"

export type ContractSummaryRow = {
  status: ContractStatus
  effectiveUntil: Date | null
}

export type ContractsSummary = {
  total: number
  draft: number
  sent: number
  signed: number
  expired: number
  terminated: number
}

// Counted by display status rather than stored status, so a sent contract whose window closed is
// reported as expired here exactly as the list row renders it (services/contractExpiry.ts).
export function summarizeContracts(
  rows: readonly ContractSummaryRow[],
  now: Date
): ContractsSummary {
  const summary: ContractsSummary = {
    total: rows.length,
    draft: 0,
    sent: 0,
    signed: 0,
    expired: 0,
    terminated: 0
  }

  for (const row of rows) {
    const displayStatus = resolveContractDisplayStatus(row.status, row.effectiveUntil, now)

    summary[displayStatus] += 1
  }

  return summary
}
