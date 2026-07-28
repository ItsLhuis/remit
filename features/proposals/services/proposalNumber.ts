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
