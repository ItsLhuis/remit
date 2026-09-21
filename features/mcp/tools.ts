import {
  fromJsonSchema,
  type CallToolResult,
  type JsonSchemaType,
  type McpServer,
  type ToolAnnotations
} from "@modelcontextprotocol/server"

import { z } from "zod"

import { type ApiResource } from "@/features/api"
import {
  apiOperations,
  getApiClient,
  getApiInvoice,
  getApiProject,
  listApiClients,
  listApiExpenses,
  listApiInvoices,
  listApiProjects,
  listApiTimeEntries,
  type ApiListParams,
  type ApiListResult
} from "@/features/api/server"

import { runMcpTool, toolError, type McpAuditTarget } from "./runTool"
import {
  getClientInputSchema,
  getInvoiceInputSchema,
  getProjectInputSchema,
  listClientsInputSchema,
  listExpensesInputSchema,
  listInvoicesInputSchema,
  listProjectsInputSchema,
  listTimeEntriesInputSchema
} from "./schemas"
import { toDayRange, toFlagFilter, toIdFilter } from "./services/toolArguments"
import { type McpSession } from "./session"

// A tool is the MCP face of one REST operation. It takes that operation's resource — and so its
// scope — and its response schema from `features/api/operations.ts` rather than declaring its own,
// which is how a token can never read more through MCP than through the API: both surfaces admit
// the same resource through `authenticateApiRequest` and publish the same fields.
// `__tests__/tools.test.ts` pins every tool to its operation.
export type McpTool = {
  name: string
  resource: ApiResource
  operationId: string
  inputSchema: z.ZodObject
  outputSchema: z.ZodObject
  register: (server: McpServer, session: McpSession) => void
}

type ToolOperation = {
  operationId: string
  resource: ApiResource
  response: z.ZodObject
}

type ToolDefinition<TInput extends z.ZodObject> = {
  name: string
  title: string
  description: string
  operation: ToolOperation
  inputSchema: TInput
}

type ListPage = {
  data: unknown[]
  pagination: { page: number; perPage: number; total: number }
}

type ListToolDefinition<TInput extends z.ZodObject> = ToolDefinition<TInput> & {
  read: (input: z.output<TInput>) => Promise<ListPage>
}

type ItemToolDefinition<TInput extends z.ZodObject> = ToolDefinition<TInput> & {
  target: (input: z.output<TInput>) => McpAuditTarget
  read: (input: z.output<TInput>) => Promise<unknown>
}

// Hints only: the specification tells a client to treat annotations as untrusted. What keeps these
// tools read-only is that nothing they call writes.
const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
}

export const MCP_TOOLS: readonly McpTool[] = [
  defineListTool({
    name: "list_clients",
    title: "List clients",
    description:
      "List clients, alphabetically by name, with each client's email, billing currency and outstanding balance. Returns one page of rows and the total count; raise `page` to read further.",
    operation: apiOperations.listClients,
    inputSchema: listClientsInputSchema,
    read: (input) => readPage(input, (paging) => listApiClients(paging, { search: input.search }))
  }),
  defineItemTool({
    name: "get_client",
    title: "Get a client",
    description:
      "One client's billing details — email, phone, website, tax id and postal address — with the balance still outstanding on their invoices.",
    operation: apiOperations.getClient,
    inputSchema: getClientInputSchema,
    target: (input) => ({ entityType: "client", entityId: input.clientId }),
    read: (input) => getApiClient(input.clientId)
  }),
  defineListTool({
    name: "list_projects",
    title: "List projects",
    description:
      "List projects, most recently created first, with each project's client, stage, dates, budget and hourly rate.",
    operation: apiOperations.listProjects,
    inputSchema: listProjectsInputSchema,
    read: (input) =>
      readPage(input, (paging) =>
        listApiProjects(paging, { search: input.search, statuses: input.statuses })
      )
  }),
  defineItemTool({
    name: "get_project",
    title: "Get a project",
    description: "One project with its description, stage, dates, budget and hourly rate.",
    operation: apiOperations.getProject,
    inputSchema: getProjectInputSchema,
    target: (input) => ({ entityType: "project", entityId: input.projectId }),
    read: (input) => getApiProject(input.projectId)
  }),
  defineListTool({
    name: "list_invoices",
    title: "List invoices",
    description:
      "List invoices, soonest due first, with each invoice's state, total, amount paid and amount still outstanding. Filter by state, client, issue date or due date to answer what is overdue, what is owed by a client, or what was invoiced in a period.",
    operation: apiOperations.listInvoices,
    inputSchema: listInvoicesInputSchema,
    read: (input) =>
      readPage(input, (paging) =>
        listApiInvoices(paging, {
          search: input.search,
          statuses: input.statuses,
          clientIds: toIdFilter(input.clientId),
          issued: toDayRange(input.issuedFrom, input.issuedTo, "date"),
          due: toDayRange(input.dueFrom, input.dueTo, "date")
        })
      )
  }),
  defineItemTool({
    name: "get_invoice",
    title: "Get an invoice",
    description:
      "One invoice with its line items, subtotal, discount, tax, total, amount paid, dates and the notes printed on it.",
    operation: apiOperations.getInvoice,
    inputSchema: getInvoiceInputSchema,
    target: (input) => ({ entityType: "invoice", entityId: input.invoiceId }),
    read: (input) => getApiInvoice(input.invoiceId)
  }),
  defineListTool({
    name: "list_time_entries",
    title: "List time entries",
    description:
      "List time entries, most recent first, with each entry's project, duration in seconds, hourly rate, amount and the invoice it was billed on. Billable entries that are not invoiced are the work that can still be billed.",
    operation: apiOperations.listTimeEntries,
    inputSchema: listTimeEntriesInputSchema,
    read: (input) =>
      readPage(input, (paging) =>
        listApiTimeEntries(paging, {
          search: input.search,
          projectIds: toIdFilter(input.projectId),
          billable: toFlagFilter(input.billable, "billable", "nonBillable"),
          invoiced: toFlagFilter(input.invoiced, "invoiced", "unbilled"),
          started: toDayRange(input.startedFrom, input.startedTo, "instant")
        })
      )
  }),
  defineListTool({
    name: "list_expenses",
    title: "List expenses",
    description:
      "List expenses, most recent first, with each expense's category, amount, project or client, and whether it is billed on to the client and on which invoice.",
    operation: apiOperations.listExpenses,
    inputSchema: listExpensesInputSchema,
    read: (input) =>
      readPage(input, (paging) =>
        listApiExpenses(paging, {
          search: input.search,
          projectIds: toIdFilter(input.projectId),
          clientIds: toIdFilter(input.clientId),
          rebillable: toFlagFilter(input.rebillable, "rebillable", "nonRebillable"),
          invoiced: toFlagFilter(input.invoiced, "invoiced", "unbilled"),
          spent: toDayRange(input.spentFrom, input.spentTo, "date")
        })
      )
  })
]

export function findMcpTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name)
}

function defineListTool<TInput extends z.ZodObject>(
  definition: ListToolDefinition<TInput>
): McpTool {
  return toMcpTool(definition, (session, input) =>
    runMcpTool(
      session,
      {
        tool: definition.name,
        response: definition.operation.response,
        arguments: input,
        target: null
      },
      async () => {
        const page = await definition.read(input)

        return { found: true, payload: page, resultCount: page.data.length }
      }
    )
  )
}

function defineItemTool<TInput extends z.ZodObject>(
  definition: ItemToolDefinition<TInput>
): McpTool {
  return toMcpTool(definition, (session, input) =>
    runMcpTool(
      session,
      {
        tool: definition.name,
        response: definition.operation.response,
        arguments: input,
        target: definition.target(input)
      },
      async () => {
        const item = await definition.read(input)

        return item ? { found: true, payload: { data: item }, resultCount: 1 } : { found: false }
      }
    )
  )
}

// The SDK validates arguments against `inputSchema` before a handler runs, but hands them over
// untyped. Parsing again here is what gives each read its typed arguments, and keeps the rule that
// no argument reaches a query unvalidated true of this file on its own rather than of the SDK.
function toMcpTool<TInput extends z.ZodObject>(
  definition: ToolDefinition<TInput>,
  run: (session: McpSession, input: z.output<TInput>) => Promise<CallToolResult>
): McpTool {
  const inputSchema: z.ZodObject = definition.inputSchema
  const outputSchema = toToolOutputSchema(definition.operation.response)

  return {
    name: definition.name,
    resource: definition.operation.resource,
    operationId: definition.operation.operationId,
    inputSchema,
    outputSchema: definition.operation.response,
    register: (server, session) => {
      server.registerTool(
        definition.name,
        {
          title: definition.title,
          description: definition.description,
          inputSchema,
          outputSchema,
          annotations: READ_ONLY_ANNOTATIONS
        },
        async (rawInput) => {
          const parsed = definition.inputSchema.safeParse(rawInput)

          if (!parsed.success) return toolError(parsed.error.issues[0].message)

          return run(session, parsed.data)
        }
      )
    }
  }
}

// The REST schemas carry OpenAPI component names as `id` metadata, which `features/api/openapi.ts`
// turns into `$ref`s. Zod also writes each name into the JSON Schema as an `id` keyword that draft
// 2020-12 does not define, and a strict validator — the reference client's among them — then refuses
// the tool outright. The keyword is dropped here; the `$defs` the names produced stay.
//
// The assertion bridges two packages' JSON Schema types, which disagree only on `$vocabulary`
// (booleans in the specification and in Zod, strings in the SDK's type); no tool schema carries one.
function toToolOutputSchema(response: z.ZodObject) {
  const jsonSchema = z.toJSONSchema(response, {
    io: "output",
    target: "draft-2020-12",
    override: (context) => {
      delete context.jsonSchema.id
    }
  })

  return fromJsonSchema(jsonSchema as JsonSchemaType)
}

async function readPage<TRow>(
  input: ApiListParams,
  list: (paging: ApiListParams) => Promise<ApiListResult<TRow>>
): Promise<ListPage> {
  const paging = { page: input.page, perPage: input.perPage }
  const result = await list(paging)

  return { data: result.rows, pagination: { ...paging, total: result.total } }
}
