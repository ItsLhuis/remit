"use client"

import { ProposalRouteError } from "@/features/proposals"

type ProposalsErrorProps = {
  reset: () => void
}

const ProposalsError = ({ reset }: ProposalsErrorProps) => {
  return <ProposalRouteError reset={reset} />
}

export default ProposalsError
