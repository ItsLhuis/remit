export {
  createProposal,
  sendProposal,
  softDeleteProposal,
  updateProposal,
  type DeleteProposalResult,
  type ProposalMutationResult,
  type SendProposalResult
} from "./mutations"

export {
  getProposalDefaults,
  getProposalDetail,
  getProposalEditorData,
  getProposalForEdit,
  getProposalOverviewPageData,
  getProposalsPageData,
  listProposalOverview,
  listProposalsByProject
} from "./queries"

export {
  emitProposalCreated,
  emitProposalDeleted,
  emitProposalSent,
  emitProposalUpdated
} from "./events"
