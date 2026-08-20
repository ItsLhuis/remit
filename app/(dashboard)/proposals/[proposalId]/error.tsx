"use client"

import { ProposalRouteError } from "@/features/proposals"

type ProposalDetailErrorProps = {
  reset: () => void
}

const ProposalDetailError = ({ reset }: ProposalDetailErrorProps) => {
  return <ProposalRouteError reset={reset} />
}

export default ProposalDetailError
