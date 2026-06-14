export {
  createClient,
  softDeleteClient,
  updateClient,
  type ClientMutationResult,
  type DeleteClientResult
} from "./mutations"

export {
  getClientDefaults,
  getClientDetail,
  getClientFilterOptions,
  getClientForEdit,
  getClientsPageData,
  listClients,
  toClientFormData,
  type ClientListRow
} from "./queries"

export { emitClientCreated, emitClientDeleted, emitClientUpdated } from "./events"
