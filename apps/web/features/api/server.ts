export { authenticateApiRequest, type ApiRequestContext } from "./authenticate"

export {
  handleApiDocumentRequest,
  handleApiItemRequest,
  handleApiListRequest
} from "./handleApiRequest"

export { getOpenApiDocument } from "./openapi"

export { apiOperations, type ApiOperation } from "./operations"

export {
  getApiClient,
  getApiInvoice,
  getApiProject,
  listApiClients,
  listApiExpenses,
  listApiInvoices,
  listApiProjects,
  listApiTimeEntries,
  type ApiExpenseFilters,
  type ApiInvoiceFilters,
  type ApiListResult,
  type ApiProjectFilters,
  type ApiSearchFilter,
  type ApiTimeEntryFilters
} from "./resources"

export { type ApiListParams } from "./schemas"
