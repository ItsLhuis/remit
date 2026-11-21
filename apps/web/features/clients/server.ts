export {
  confirmClientImageUpload,
  removeClientImage,
  type ClientImageResult
} from "./imageMutations"

export { createClient, updateClient, type ClientMutationResult } from "./mutations"

export {
  restoreClient,
  restoreClientContact,
  softDeleteClient,
  type DeleteClientResult
} from "./trashMutations"

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

// Also exported from the client-safe `index.ts`, and reachable from a server module without it:
// `features/api/resources.ts` feeds the list read the same parsed query the clients screen does,
// and reaching it through the root barrel would drag the component graph into a route handler.
export { parseClientListQuery } from "./schemas"
