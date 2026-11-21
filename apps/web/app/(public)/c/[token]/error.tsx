"use client"

import { PublicContractUnavailable } from "@/features/contracts"

// The anonymous surface never offers a retry and never shows the error: a link-holder cannot act on
// a server fault, and the same "unavailable" panel a missing token renders keeps a crash from being
// distinguishable from a bad token.
const PublicContractError = () => {
  return <PublicContractUnavailable />
}

export default PublicContractError
