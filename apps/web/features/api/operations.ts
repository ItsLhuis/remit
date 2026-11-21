import { z } from "zod"

import {
  apiClientDetailSchema,
  apiClientSchema,
  apiExpenseSchema,
  apiInvoiceDetailSchema,
  apiInvoiceSchema,
  apiItemResponseSchema,
  apiListResponseSchema,
  apiProjectDetailSchema,
  apiProjectSchema,
  apiTimeEntrySchema
} from "./responseSchemas"
import { type ApiResource } from "./schemas"

export type ApiOperationKind = "list" | "item" | "document"

export type ApiOperation = {
  operationId: string
  path: string
  kind: ApiOperationKind
  // Null only for the document route, which needs a valid token and no scope.
  resource: ApiResource | null
  summary: string
  response: z.ZodType
}

// The single list of what the public API serves. `openapi.ts` generates the document from it, each
// route under `app/api/v1/` answers through its entry, and `__tests__/openapi.integration.test.ts`
// fails when a route file exists that no entry describes, or an entry names a path with no route.
// That pair is what keeps the document from describing an endpoint that is not there, or omitting
// one that is.
export const apiOperations = {
  listClients: {
    operationId: "listClients",
    path: "/api/v1/clients",
    kind: "list",
    resource: "clients",
    summary: "List clients",
    response: apiListResponseSchema(apiClientSchema, "ClientList")
  },
  getClient: {
    operationId: "getClient",
    path: "/api/v1/clients/{id}",
    kind: "item",
    resource: "clients",
    summary: "Get a client",
    response: apiItemResponseSchema(apiClientDetailSchema, "ClientResponse")
  },
  listProjects: {
    operationId: "listProjects",
    path: "/api/v1/projects",
    kind: "list",
    resource: "projects",
    summary: "List projects",
    response: apiListResponseSchema(apiProjectSchema, "ProjectList")
  },
  getProject: {
    operationId: "getProject",
    path: "/api/v1/projects/{id}",
    kind: "item",
    resource: "projects",
    summary: "Get a project",
    response: apiItemResponseSchema(apiProjectDetailSchema, "ProjectResponse")
  },
  listInvoices: {
    operationId: "listInvoices",
    path: "/api/v1/invoices",
    kind: "list",
    resource: "invoices",
    summary: "List invoices",
    response: apiListResponseSchema(apiInvoiceSchema, "InvoiceList")
  },
  getInvoice: {
    operationId: "getInvoice",
    path: "/api/v1/invoices/{id}",
    kind: "item",
    resource: "invoices",
    summary: "Get an invoice with its line items",
    response: apiItemResponseSchema(apiInvoiceDetailSchema, "InvoiceResponse")
  },
  listTimeEntries: {
    operationId: "listTimeEntries",
    path: "/api/v1/time-entries",
    kind: "list",
    resource: "time_entries",
    summary: "List time entries",
    response: apiListResponseSchema(apiTimeEntrySchema, "TimeEntryList")
  },
  listExpenses: {
    operationId: "listExpenses",
    path: "/api/v1/expenses",
    kind: "list",
    resource: "expenses",
    summary: "List expenses",
    response: apiListResponseSchema(apiExpenseSchema, "ExpenseList")
  },
  getOpenApiDocument: {
    operationId: "getOpenApiDocument",
    path: "/api/v1/openapi.json",
    kind: "document",
    resource: null,
    summary: "This API's OpenAPI document",
    response: z.record(z.string(), z.unknown()).meta({ id: "OpenApiDocument" })
  }
} as const satisfies Record<string, ApiOperation>
