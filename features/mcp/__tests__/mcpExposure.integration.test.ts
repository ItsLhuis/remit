import { eq } from "drizzle-orm"

import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs } from "@/database/schema"

import {
  makeClient,
  makeExpense,
  makeInvoice,
  makeProject,
  makeSettings,
  makeTimeEntry,
  makeUpload
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

import { ALL_SCOPES, connectMcpClient, makeCaller } from "./mcpTestClient"

const mocks = vi.hoisted(() => ({
  consume: vi.fn()
}))

vi.mock("@/lib/rateLimit", () => ({
  rateLimitInstance: { consume: mocks.consume }
}))

const NOW = new Date("2026-09-19T12:00:00.000Z")

// Every value here is one no tool may ever publish. Each is planted in the column that holds it and
// then searched for in the raw bytes of every response, so a read model or serialiser that starts
// carrying one fails here whichever tool it reaches.
const SENTINELS = {
  clientNotes: "sentinel-nda-covered-note",
  portalToken: "sentinel-portal-bearer-token",
  receiptKey: "receipts/sentinel-storage-key.png",
  smtpPassword: "sentinel-smtp-password",
  stripeSecret: "sentinel-stripe-secret-key",
  trashedClient: "Sentinel Trashed Client"
}

async function seedInstance() {
  await makeSettings({
    mcpEnabled: true,
    smtpPass: SENTINELS.smtpPassword,
    stripeSecretKey: SENTINELS.stripeSecret
  })

  const client = await makeClient({
    name: "Acme",
    notes: SENTINELS.clientNotes,
    portalToken: SENTINELS.portalToken
  })

  await makeClient({ name: SENTINELS.trashedClient, deletedAt: new Date("2026-09-01") })

  const project = await makeProject({ clientId: client.id, name: "Acme retainer" })
  const receipt = await makeUpload({ path: SENTINELS.receiptKey, bucket: "documents" })
  const overdue = await makeInvoice({
    clientId: client.id,
    status: "sent",
    issueDate: new Date("2026-08-01"),
    dueDate: new Date("2026-08-31"),
    totalCents: 120_000
  })
  const paid = await makeInvoice({
    clientId: client.id,
    status: "paid",
    issueDate: new Date("2026-07-01"),
    dueDate: new Date("2026-07-31"),
    paidAt: new Date("2026-07-20"),
    totalCents: 50_000,
    amountPaidCents: 50_000
  })

  await makeTimeEntry({ projectId: project.id, description: "Unbilled design work" })
  await makeTimeEntry({
    projectId: project.id,
    description: "Billed design work",
    invoicedInId: paid.id
  })
  await makeExpense({ projectId: project.id, receiptUploadId: receipt.id })

  return { client, project, overdue, paid }
}

beforeAll(async () => {
  await import("@/app/api/mcp/route")
}, 180_000)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)

  mocks.consume.mockReset()
  mocks.consume.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("MCP exposure", () => {
  test("no tool, description or error ever carries a note, a token, a key or a trashed record", async () => {
    const { client, project, overdue } = await seedInstance()
    const { token } = await makeCaller("owner", ALL_SCOPES)
    const bodies: string[] = []

    const mcp = await connectMcpClient(token.token, { bodies })

    await mcp.listTools()
    await mcp.callTool({ name: "list_clients", arguments: {} })
    await mcp.callTool({ name: "get_client", arguments: { clientId: client.id } })
    await mcp.callTool({ name: "list_projects", arguments: {} })
    await mcp.callTool({ name: "get_project", arguments: { projectId: project.id } })
    await mcp.callTool({ name: "list_invoices", arguments: {} })
    await mcp.callTool({ name: "get_invoice", arguments: { invoiceId: overdue.id } })
    await mcp.callTool({ name: "list_time_entries", arguments: {} })
    await mcp.callTool({ name: "list_expenses", arguments: {} })
    await mcp.callTool({ name: "get_client", arguments: { clientId: crypto.randomUUID() } })
    await mcp.callTool({ name: "list_invoices", arguments: { statuses: ["lost"] } })

    const wire = bodies.join("\n")

    expect(wire).toContain("Acme")
    expect(wire).toContain("hasReceipt")

    for (const value of [...Object.values(SENTINELS), overdue.publicToken ?? "", token.token]) {
      expect(wire).not.toContain(value)
    }

    await mcp.close()
  })
})

describe("MCP audit trail", () => {
  test("records each call's tool and arguments, with a search recorded only as having been made", async () => {
    const { client } = await seedInstance()
    const { user, token } = await makeCaller("owner", ALL_SCOPES)

    const mcp = await connectMcpClient(token.token)

    await mcp.callTool({ name: "list_clients", arguments: { search: "Acme" } })
    await mcp.callTool({ name: "get_client", arguments: { clientId: client.id } })
    await mcp.callTool({ name: "get_client", arguments: { clientId: crypto.randomUUID() } })

    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "mcp.tool.called"))
      .orderBy(auditLogs.createdAt)

    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({
      actorUserId: user.id,
      actorRole: "owner",
      metadata: {
        apiTokenId: token.id,
        tool: "list_clients",
        arguments: { searched: true, page: 1, perPage: 25 },
        outcome: "returned",
        resultCount: 1
      }
    })
    expect(entries[1]).toMatchObject({
      targetEntityType: "client",
      targetEntityId: client.id,
      metadata: { tool: "get_client", outcome: "returned" }
    })
    expect(entries[2]?.metadata).toMatchObject({ outcome: "not_found", resultCount: 0 })
    expect(JSON.stringify(entries)).not.toContain("Acme")
    expect(JSON.stringify(entries)).not.toContain(client.email)

    await mcp.close()
  })
})

describe("MCP filters", () => {
  test("answers what is overdue with the overdue invoice alone", async () => {
    const { overdue } = await seedInstance()
    const { token } = await makeCaller("owner", ["invoices:read"])

    const mcp = await connectMcpClient(token.token)
    const result = await mcp.callTool({
      name: "list_invoices",
      arguments: { statuses: ["overdue"] }
    })

    expect(result.structuredContent).toMatchObject({
      data: [expect.objectContaining({ id: overdue.id, outstandingCents: 120_000 })],
      pagination: { total: 1 }
    })

    await mcp.close()
  })

  test("narrows invoices to a calendar month of issue dates, both ends inclusive", async () => {
    const { paid } = await seedInstance()
    const { token } = await makeCaller("owner", ["invoices:read"])

    const mcp = await connectMcpClient(token.token)
    const result = await mcp.callTool({
      name: "list_invoices",
      arguments: { issuedFrom: "2026-07-01", issuedTo: "2026-07-31" }
    })

    expect(result.structuredContent).toMatchObject({
      data: [expect.objectContaining({ id: paid.id })],
      pagination: { total: 1 }
    })

    await mcp.close()
  })

  test("answers what is still unbilled with billable time no invoice carries", async () => {
    await seedInstance()
    const { token } = await makeCaller("owner", ["time_entries:read"])

    const mcp = await connectMcpClient(token.token)
    const result = await mcp.callTool({
      name: "list_time_entries",
      arguments: { billable: true, invoiced: false }
    })

    expect(result.structuredContent).toMatchObject({
      data: [expect.objectContaining({ description: "Unbilled design work", invoiceId: null })],
      pagination: { total: 1 }
    })

    await mcp.close()
  })
})
