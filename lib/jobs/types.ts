// The typed job catalog. A producer call is rejected by the compiler unless the name and payload
// appear here, mirroring `lib/events/types.ts` for the event bus.
export type JobMap = {
  "proposal.pdf.render": {
    proposalId: string
  }
  "contract.pdf.render": {
    contractId: string
  }
}

export type JobName = keyof JobMap
