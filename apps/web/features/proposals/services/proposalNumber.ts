export type ProposalNumberInput = {
  prefix: string
  nextNumber: number
  paddingWidth: number
}

// A number wider than the configured padding is never truncated — `PROP-` at width 4 yields
// `PROP-0042` but still yields `PROP-100000` once the counter outgrows the pad. Truncating would
// mint a duplicate against the `proposals.number` unique index.
export function formatProposalNumber({
  prefix,
  nextNumber,
  paddingWidth
}: ProposalNumberInput): string {
  return `${prefix}${String(nextNumber).padStart(paddingWidth, "0")}`
}

// Date-only, UTC-constructed per money-and-dates.md: a validity window is a calendar span, and
// deriving it from local time would shift the expiry a day for any instance west of UTC.
export function calculateProposalValidUntil(issuedAt: Date, validityDays: number): Date | null {
  if (validityDays <= 0) return null

  const validUntil = new Date(
    Date.UTC(issuedAt.getUTCFullYear(), issuedAt.getUTCMonth(), issuedAt.getUTCDate())
  )

  validUntil.setUTCDate(validUntil.getUTCDate() + validityDays)

  return validUntil
}

// The counterpart read of the window `calculateProposalValidUntil` opens, and deliberately
// inclusive: `validUntil` is the last calendar day the client may still respond, so the proposal
// expires only once the UTC date has moved past it. Both sides compare UTC date-only values, so an
// instance in any zone agrees with the stored `date` column about which day it is.
export function isProposalExpired(validUntil: Date | null, now: Date): boolean {
  if (!validUntil) return false

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  const lastDay = Date.UTC(
    validUntil.getUTCFullYear(),
    validUntil.getUTCMonth(),
    validUntil.getUTCDate()
  )

  return today > lastDay
}
