export {
  confirmClientImageUpload,
  removeClientImage,
  type ClientImageResult
} from "./imageMutations"

export {
  createClient,
  softDeleteClient,
  updateClient,
  type ClientMutationResult,
  type DeleteClientResult
} from "./mutations"

export { restoreClient, restoreClientContact } from "./restoreMutations"

export { forgetClient } from "./forgetMutations"

export { getClientPortal } from "./publicQueries"

export {
  getClientDocumentRecipient,
  listClientContacts,
  listClientRecipientIdentities
} from "./contactQueries"

export {
  getClient,
  getClientDefaults,
  getClientDetail,
  getClientFilterOptions,
  getClientForEdit,
  getClientsPageData,
  listClientOptions,
  listClients,
  toClientFormData,
  type ClientListRow,
  type ClientOption
} from "./queries"

export { emitClientCreated, emitClientDeleted, emitClientUpdated } from "./events"
