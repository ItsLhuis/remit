import { type Blocks } from "@/features/templates"

export type ContractBlocksFromProposalInput = {
  templateBlocks: Blocks | null
  proposalBlocks: Blocks
}

// Emptiness is a content question, not a length question: a snapshot of nothing but hidden blocks
// renders a blank page, and sending a blank contract is the failure sendContract must refuse.
export function hasContractContent(blocks: Blocks): boolean {
  return blocks.some((block) => !block.hidden)
}

// Conversion prefers the contract template because a contract is a different document from the
// proposal it came out of - different clauses, different signature block. The proposal's own
// snapshot is the fallback so a conversion still produces something editable on an instance with no
// contract template configured; the resulting draft is then edited before send.
export function buildContractBlocksFromProposal({
  templateBlocks,
  proposalBlocks
}: ContractBlocksFromProposalInput): Blocks {
  if (templateBlocks && hasContractContent(templateBlocks)) return templateBlocks

  return proposalBlocks
}
