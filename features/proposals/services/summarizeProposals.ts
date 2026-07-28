import { type ProposalStatus } from "../schemas"

export type ProposalSummaryInput = {
  status: ProposalStatus
  currency: string
  totalCents: number
}

export type ProposalAcceptedValue = {
  currency: string
  totalCents: number
}

export type ProposalsSummaryResult = {
  total: number
  draft: number
  awaiting: number
  accepted: number
  acceptedValueByCurrency: ProposalAcceptedValue[]
  hasSingleCurrency: boolean
}

// `awaiting` counts only `sent`: a draft is not with the client yet, and accepted/rejected have
// already come back, so `sent` is the one status the freelancer is actually waiting on.
//
// Accepted value is bucketed per currency rather than summed: the instance-wide list spans projects
// that may each price in a different currency, and Remit holds no exchange rates, so a single total
// would be a number that means nothing.
export function summarizeProposals(
  proposals: readonly ProposalSummaryInput[]
): ProposalsSummaryResult {
  const acceptedTotals = new Map<string, number>()

  let draft = 0
  let awaiting = 0
  let accepted = 0

  for (const proposal of proposals) {
    if (proposal.status === "draft") draft += 1
    if (proposal.status === "sent") awaiting += 1

    if (proposal.status === "accepted") {
      accepted += 1
      acceptedTotals.set(
        proposal.currency,
        (acceptedTotals.get(proposal.currency) ?? 0) + proposal.totalCents
      )
    }
  }

  const acceptedValueByCurrency = Array.from(acceptedTotals.entries())
    .map(([currency, totalCents]) => ({ currency, totalCents }))
    .sort((first, second) => second.totalCents - first.totalCents)

  return {
    total: proposals.length,
    draft,
    awaiting,
    accepted,
    acceptedValueByCurrency,
    hasSingleCurrency: acceptedValueByCurrency.length <= 1
  }
}
