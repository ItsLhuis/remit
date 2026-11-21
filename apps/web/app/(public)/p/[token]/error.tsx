"use client"

import { PublicProposalUnavailable } from "@/features/proposals"

// The anonymous surface never offers a retry and never shows the error: a link-holder cannot act on
// a server fault, and the same "unavailable" panel a missing token renders keeps a crash from being
// distinguishable from a bad token.
const PublicProposalError = () => {
  return <PublicProposalUnavailable />
}

export default PublicProposalError
