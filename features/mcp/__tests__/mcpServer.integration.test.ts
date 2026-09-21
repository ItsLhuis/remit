import { NextRequest } from "next/server"

import { eq } from "drizzle-orm"

import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest"

import { apiTokens, auditLogs, members } from "@/database/schema"

import { makeClient, makeSettings } from "@/tests/factories"
import { database } from "@/tests/integration/database"

import {
  ALL_SCOPES,
  connectMcpClient,
  makeCaller,
  makeRouteFetch,
  postMcpMessage,
  toolCallMessage,
  type ApiTokenScopeValue
} from "./mcpTestClient"

const mocks = vi.hoisted(() => ({
  consume: vi.fn()
}))

vi.mock("@/lib/rateLimit", () => ({
  rateLimitInstance: { consume: mocks.consume }
}))

// The REST collection route for each resource, which is the other half of every parity assertion.
const REST_COLLECTIONS = {
  clients: () => import("@/app/api/v1/clients/route"),
  projects: () => import("@/app/api/v1/projects/route"),
  invoices: () => import("@/app/api/v1/invoices/route"),
  time_entries: () => import("@/app/api/v1/time-entries/route"),
  expenses: () => import("@/app/api/v1/expenses/route")
} as const

const TOOL_RESOURCES: Record<string, keyof typeof REST_COLLECTIONS> = {
  list_clients: "clients",
  get_client: "clients",
  list_projects: "projects",
  get_project: "projects",
  list_invoices: "invoices",
  get_invoice: "invoices",
  list_time_entries: "time_entries",
  list_expenses: "expenses"
}

async function restStatus(resource: keyof typeof REST_COLLECTIONS, token: string) {
  const { GET } = await REST_COLLECTIONS[resource]()

  const response = await GET(
    new NextRequest(`http://localhost/api/v1/${resource.replace("_", "-")}`, {
      headers: { authorization: `Bearer ${token}` }
    })
  )

  return response.status
}

async function listedResources(token: string): Promise<string[]> {
  const client = await connectMcpClient(token)
  const { tools } = await client.listTools()

  await client.close()

  return [...new Set(tools.map((tool) => TOOL_RESOURCES[tool.name]))].toSorted()
}

beforeAll(async () => {
  await Promise.all([
    import("@/app/api/mcp/route"),
    ...Object.values(REST_COLLECTIONS).map((load) => load())
  ])
}, 180_000)

beforeEach(() => {
  mocks.consume.mockReset()
  mocks.consume.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
})

describe("MCP protocol", () => {
  test("a 2025-era client completes the handshake, lists its tools and calls one", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("owner", ["clients:read"])

    await makeClient({ name: "Acme" })

    const client = await connectMcpClient(token.token)
    const { tools } = await client.listTools()
    const result = await client.callTool({ name: "list_clients", arguments: {} })

    expect(tools.map((tool) => tool.name)).toEqual(["list_clients", "get_client"])
    expect(result.structuredContent).toMatchObject({
      data: [expect.objectContaining({ name: "Acme" })],
      pagination: { page: 1, perPage: 25, total: 1 }
    })

    await client.close()
  })

  test("a 2026-07-28 client lists its tools and calls one", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("owner", ["clients:read"])

    await makeClient({ name: "Acme" })

    const client = await connectMcpClient(token.token, { era: "modern" })
    const { tools } = await client.listTools()
    const result = await client.callTool({ name: "list_clients", arguments: {} })

    expect(tools.map((tool) => tool.name)).toEqual(["list_clients", "get_client"])
    expect(result.structuredContent).toMatchObject({
      data: [expect.objectContaining({ name: "Acme" })]
    })

    await client.close()
  })

  test("marks every tool read-only for the client", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("owner", ALL_SCOPES)

    const client = await connectMcpClient(token.token)
    const { tools } = await client.listTools()

    expect(tools).toHaveLength(8)
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true)

    await client.close()
  })

  test("answers a batch with a refusal rather than admitting several calls at once", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("owner", ALL_SCOPES)

    const response = await postMcpMessage([toolCallMessage("list_clients")], {
      authorization: `Bearer ${token.token}`
    })

    expect(response.status).toBe(400)
  })

  test("answers the 2025-era stream and session methods with 405", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("owner", ALL_SCOPES)

    const response = await makeRouteFetch()("http://localhost:3000/api/mcp", {
      method: "GET",
      headers: { authorization: `Bearer ${token.token}`, accept: "text/event-stream" }
    })

    expect(response.status).toBe(405)
  })

  test("reports invalid and unknown arguments as a tool error the model can correct", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("owner", ALL_SCOPES)

    const client = await connectMcpClient(token.token)
    const badState = await client.callTool({
      name: "list_invoices",
      arguments: { statuses: ["lost"] }
    })
    const unknown = await client.callTool({
      name: "list_invoices",
      arguments: { includeDeleted: true }
    })

    expect(badState.isError).toBe(true)
    expect(unknown.isError).toBe(true)

    await client.close()
  })
})

describe("MCP admission", () => {
  test("is unavailable while switched off, even to a valid token", async () => {
    await makeSettings({ mcpEnabled: false })
    const { token } = await makeCaller("owner", ALL_SCOPES)

    const response = await postMcpMessage(toolCallMessage("list_clients"), {
      authorization: `Bearer ${token.token}`
    })

    expect(response.status).toBe(404)
    await expect(connectMcpClient(token.token)).rejects.toThrow()
  })

  test("refuses a browser page on another host with 403 and admits the instance's own", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("owner", ALL_SCOPES)
    const listTools = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }

    const foreign = await postMcpMessage(listTools, {
      authorization: `Bearer ${token.token}`,
      origin: "http://rebinding.example"
    })
    const own = await postMcpMessage(listTools, {
      authorization: `Bearer ${token.token}`,
      origin: "http://localhost:3000"
    })

    expect(foreign.status).toBe(403)
    expect(own.status).not.toBe(403)
  })

  test("answers a missing token, an unknown token and a token outside its scope identically", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("owner", ["clients:read"])

    const missing = await postMcpMessage(toolCallMessage("list_invoices"))
    const unknown = await postMcpMessage(toolCallMessage("list_invoices"), {
      authorization: `Bearer remit_${"A".repeat(43)}`
    })
    const outOfScope = await postMcpMessage(toolCallMessage("list_invoices"), {
      authorization: `Bearer ${token.token}`
    })

    const bodies = await Promise.all([missing, unknown, outOfScope].map((r) => r.text()))

    expect([missing.status, unknown.status, outOfScope.status]).toEqual([401, 401, 401])
    expect(new Set(bodies).size).toBe(1)
  })

  test("limits calls per token and records the tripped limit", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("owner", ALL_SCOPES)

    mocks.consume.mockImplementation(async (key: string) => ({
      allowed: !key.startsWith("mcp.token:"),
      remaining: 0,
      resetAt: new Date()
    }))

    const response = await postMcpMessage(toolCallMessage("list_clients"), {
      authorization: `Bearer ${token.token}`
    })
    const [entry] = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "auth.rate_limit.tripped"))

    expect(response.status).toBe(429)
    expect(entry?.metadata).toMatchObject({ route: "/api/mcp", apiTokenId: token.id })
  })
})

describe("MCP and REST permissions", () => {
  test.each<[string, ApiTokenScopeValue[]]>([
    ["clients only", ["clients:read"]],
    ["projects only", ["projects:read"]],
    ["invoices only", ["invoices:read"]],
    ["time entries only", ["time_entries:read"]],
    ["expenses only", ["expenses:read"]],
    ["invoices and expenses", ["invoices:read", "expenses:read"]],
    ["every scope", ALL_SCOPES]
  ])("a token scoped to %s reaches the same resources through both", async (_, scopes) => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("assistant", scopes)

    const throughMcp = await listedResources(token.token)
    const throughRest: string[] = []

    for (const resource of Object.keys(REST_COLLECTIONS) as (keyof typeof REST_COLLECTIONS)[]) {
      if ((await restStatus(resource, token.token)) === 200) throughRest.push(resource)
    }

    expect(throughMcp).toEqual(throughRest.toSorted())
  })

  test("returns the same records as the REST collection for the same token and page", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("accountant", ["clients:read"])

    await makeClient({ name: "Acme" })
    await makeClient({ name: "Birch" })

    const client = await connectMcpClient(token.token)
    const result = await client.callTool({ name: "list_clients", arguments: { perPage: 10 } })
    const { GET } = await REST_COLLECTIONS.clients()
    const rest = await GET(
      new NextRequest("http://localhost/api/v1/clients?perPage=10", {
        headers: { authorization: `Bearer ${token.token}` }
      })
    )

    expect(result.structuredContent).toEqual(await rest.json())

    await client.close()
  })

  test("refuses the next call on both surfaces once the token is revoked mid-session", async () => {
    await makeSettings({ mcpEnabled: true })
    const { token } = await makeCaller("owner", ["clients:read"])

    const client = await connectMcpClient(token.token)

    await client.callTool({ name: "list_clients", arguments: {} })
    await database
      .update(apiTokens)
      .set({ revokedAt: new Date() })
      .where(eq(apiTokens.id, token.id))

    await expect(client.callTool({ name: "list_clients", arguments: {} })).rejects.toThrow()
    expect(await restStatus("clients", token.token)).toBe(401)

    await client.close()
  })

  test("refuses both surfaces once the token's creator loses their membership", async () => {
    await makeSettings({ mcpEnabled: true })
    const { user, token } = await makeCaller("owner", ["clients:read"])

    await database.delete(members).where(eq(members.userId, user.id))

    const response = await postMcpMessage(toolCallMessage("list_clients"), {
      authorization: `Bearer ${token.token}`
    })

    expect(response.status).toBe(401)
    expect(await restStatus("clients", token.token)).toBe(401)
  })
})
