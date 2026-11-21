"use client"

import { ProposalRouteError } from "@/features/proposals"

type ProposalErrorProps = {
  reset: () => void
}

const ProposalError = ({ reset }: ProposalErrorProps) => {
  return <ProposalRouteError reset={reset} />
}

export default ProposalError
