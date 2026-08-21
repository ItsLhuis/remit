export const PROPOSAL_OTP_LENGTH = 6

export const PROPOSAL_OTP_TTL_MINUTES = 10

// Mirrors `chk_proposal_otps_attempts`, which caps the column at 5. Raising this without raising the
// constraint turns a rejected guess into a failed INSERT, so the two move together or not at all.
export const PROPOSAL_OTP_MAX_ATTEMPTS = 5

export type ProposalRespondent = {
  email: string
  name: string
}

export type ProposalOtpRecord = {
  expiresAt: Date
  attempts: number
  usedAt: Date | null
  invalidatedAt: Date | null
}

export type ProposalOtpRejection = "consumed" | "expired" | "attempts_exhausted"

export type ProposalOtpUsability =
  | { usable: true }
  | { usable: false; reason: ProposalOtpRejection }

export function evaluateProposalOtp(otp: ProposalOtpRecord, now: Date): ProposalOtpUsability {
  if (otp.usedAt !== null || otp.invalidatedAt !== null) {
    return { usable: false, reason: "consumed" }
  }

  if (otp.expiresAt.getTime() <= now.getTime()) return { usable: false, reason: "expired" }

  if (otp.attempts >= PROPOSAL_OTP_MAX_ATTEMPTS) {
    return { usable: false, reason: "attempts_exhausted" }
  }

  return { usable: true }
}

export function getProposalOtpExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + PROPOSAL_OTP_TTL_MINUTES * 60 * 1000)
}

// A failed guess that lands on the ceiling burns the code rather than leaving it dormant until it
// expires, so a code whose attempts are spent can never be revived by a slower guesser.
export function hasExhaustedProposalOtpAttempts(attempts: number): boolean {
  return attempts >= PROPOSAL_OTP_MAX_ATTEMPTS
}

// Addresses are compared case-insensitively on the whole string, not only the domain. The local part
// is case-sensitive per RFC 5321, but no mail provider in practice treats it that way, and a client
// who types their own address with a different capitalisation must not be told they are a stranger.
export function matchesProposalRecipient(candidate: string, recipient: string): boolean {
  return candidate.trim().toLowerCase() === recipient.trim().toLowerCase()
}

// Who may answer a proposal (ADR-0027): the client's own address, or any of that client's live
// contacts. The caller supplies the list, and it is built from one client's rows only
// (`features/clients/contactQueries.ts`), so a contact of a different client is not in it and
// cannot match. The matched identity is returned rather than a boolean because the OTP is then
// issued and mailed to that address and to no other.
export function matchProposalRespondent(
  candidate: string,
  respondents: ProposalRespondent[]
): ProposalRespondent | null {
  return (
    respondents.find((respondent) => matchesProposalRecipient(candidate, respondent.email)) ?? null
  )
}
