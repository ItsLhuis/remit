import { type ContractStatus } from "../schemas"
import { type ContractDisplayStatus } from "../types"

// Inclusive last day, and UTC date-only on both sides so an instance in any zone agrees with the
// stored `date` column about which day it is (money-and-dates.md).
export function isContractExpired(effectiveUntil: Date | null, now: Date): boolean {
  if (!effectiveUntil) return false

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  const lastDay = Date.UTC(
    effectiveUntil.getUTCFullYear(),
    effectiveUntil.getUTCMonth(),
    effectiveUntil.getUTCDate()
  )

  return today > lastDay
}

// `expired` is derived at read time rather than stored: only an unsigned contract the counterparty
// already has can lapse, so the derivation applies to `sent` alone. A signed contract
// stays `signed` past its end date (the document was executed, and the record of that outlives the
// window), and a draft never lapses because it was never issued.
export function resolveContractDisplayStatus(
  status: ContractStatus,
  effectiveUntil: Date | null,
  now: Date
): ContractDisplayStatus {
  if (status !== "sent") return status

  return isContractExpired(effectiveUntil, now) ? "expired" : status
}
