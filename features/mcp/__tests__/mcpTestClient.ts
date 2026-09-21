import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"

import { makeApiToken, makeMember, makeOrganization, makeUser } from "@/tests/factories"

export type ApiTokenScopeValue =
  | "clients:read"
  | "projects:read"
  | "invoices:read"
  | "time_entries:read"
  | "expenses:read"

export const ALL_SCOPES: ApiTokenScopeValue[] = [
  "clients:read",
  "projects:read",
  "invoices:read",
  "time_entries:read",
  "expenses:read"
]

export const MCP_URL = "http://localhost:3000/api/mcp"

export async function makeCaller(
  role: "owner" | "accountant" | "assistant",
  scopes: ApiTokenScopeValue[]
) {
  const user = await makeUser()
  const organization = await makeOrganization()

  await makeMember({ userId: user.id, organizationId: organization.id, role })

  return { user, token: await makeApiToken({ createdByUserId: user.id, scopes }) }
}

// The real route module behind a real client: every request the SDK client sends is answered by the
// handler the application serves, with no network in between. `bodies` collects every raw response
// body, which is what an exposure assertion has to read — not the client's parsed view of it.
export function makeRouteFetch(bodies: string[] = []) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const route = await import("@/app/api/mcp/route")
    const request = new Request(input, init)

    const response =
      request.method === "GET"
        ? await route.GET(request)
        : request.method === "DELETE"
          ? await route.DELETE(request)
          : await route.POST(request)

    bodies.push(await response.clone().text())

    return response
  }
}

export async function connectMcpClient(
  token: string,
  options: { era?: "legacy" | "modern"; bodies?: string[] } = {}
): Promise<Client> {
  const client = new Client(
    { name: "remit-integration-test", version: "1.0.0" },
    options.era === "modern" ? { versionNegotiation: { mode: { pin: "2026-07-28" } } } : {}
  )
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    fetch: makeRouteFetch(options.bodies),
    requestInit: { headers: { authorization: `Bearer ${token}` } }
  })

  await client.connect(transport)

  return client
}

// One JSON-RPC message POSTed as a 2025-era client would, for the assertions that are about the
// HTTP answer itself rather than about what a client makes of it.
export async function postMcpMessage(
  body: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  const { POST } = await import("@/app/api/mcp/route")

  return POST(
    new Request(MCP_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...headers
      },
      body: JSON.stringify(body)
    })
  )
}

export function toolCallMessage(name: string, args: Record<string, unknown> = {}) {
  return { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }
}
