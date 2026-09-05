import { type ContractDisplayStatus, type ContractStatus } from "@/features/contracts"

import { type OutstandingByCurrency } from "./summarizeClients"

export type PortalOutstandingRow = {
  currency: string
  outstandingCents: number
}

// A client can hold invoices in more than one currency and the portal has no exchange rate to
// collapse them with — `invoices.exchange_rate` is the rate the freelancer books revenue at, not a
// rate a recipient should be shown — so what is still owed is reported once per currency instead of
// as one figure. Settled invoices are dropped rather than summed to zero: a line reading 0 answers a
// question nobody asked and competes with the currency that does carry a balance.
// A restatement of `features/contracts/services/contractExpiry.ts`'s `resolveContractDisplayStatus`,
// and deliberately not an import of it: `features/contracts` reaches `features/clients/server`
// through its own mutations, so a value import of the contracts barrel from anything this feature's
// server graph pulls in would close an import cycle. That module stays the definition, and
// `__tests__/portalStatement.test.ts` compares the two across the whole status and date matrix so
// they cannot drift apart silently. Only the type crosses the boundary here, and a type is erased.
export function resolvePortalContractStatus(
  status: ContractStatus,
  effectiveUntil: Date | null,
  now: Date
): ContractDisplayStatus {
  if (status !== "sent") return status

  if (!effectiveUntil) return status

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  const lastDay = Date.UTC(
    effectiveUntil.getUTCFullYear(),
    effectiveUntil.getUTCMonth(),
    effectiveUntil.getUTCDate()
  )

  return today > lastDay ? "expired" : status
}

export function summarizePortalOutstanding(
  rows: readonly PortalOutstandingRow[]
): OutstandingByCurrency[] {
  const totals = new Map<string, number>()

  for (const row of rows) {
    if (row.outstandingCents <= 0) continue

    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.outstandingCents)
  }

  return [...totals].map(([currency, totalCents]) => ({ currency, totalCents }))
}
