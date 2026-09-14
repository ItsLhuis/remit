import { NextRequest } from "next/server"

import { eq } from "drizzle-orm"

import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest"

import { issueApiToken } from "@/lib/apiToken"

import { apiTokens, members } from "@/database/schema"

import {
  makeApiToken,
  makeClient,
  makeInvoice,
  makeMember,
  makeOrganization,
  makeUser
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  consume: vi.fn()
}))

vi.mock("@/lib/rateLimit", () => ({
  rateLimitInstance: { consume: mocks.consume }
}))

type ApiTokenScopeValue =
  | "clients:read"
  | "projects:read"
  | "invoices:read"
  | "time_entries:read"
  | "expenses:read"

async function makeCaller(
  role: "owner" | "accountant" | "assistant",
  scopes: ApiTokenScopeValue[]
) {
  const user = await makeUser()
  const organization = await makeOrganization()

  await makeMember({ userId: user.id, organizationId: organization.id, role })

  return { user, token: await makeApiToken({ createdByUserId: user.id, scopes }) }
}

function apiRequest(path: string, token?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {}
  })
}

async function getClients(path: string, token?: string) {
  const { GET } = await import("@/app/api/v1/clients/route")

  return GET(apiRequest(path, token))
}

// The route modules pull in every feature's server graph, and the first import compiles all of it.
// Paying that once here keeps the first test's budget for the behaviour it asserts.
beforeAll(async () => {
  await Promise.all([
    import("@/app/api/v1/clients/route"),
    import("@/app/api/v1/clients/[id]/route"),
    import("@/app/api/v1/invoices/route"),
    import("@/app/api/v1/invoices/[id]/route"),
    import("@/app/api/v1/openapi.json/route")
  ])
}, 180_000)

beforeEach(() => {
  mocks.consume.mockReset()
  mocks.consume.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
})

describe("public API reads", () => {
  test("lists clients as a page without their notes, portal token or image key", async () => {
    const { token } = await makeCaller("owner", ["clients:read"])

    await makeClient({
      name: "Acme",
      notes: "Covered by the Acme NDA",
      portalToken: "portal-bearer-secret"
    })

    const response = await getClients("/api/v1/clients", token.token)
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(JSON.parse(text)).toMatchObject({
      data: [expect.objectContaining({ name: "Acme" })],
      pagination: { page: 1, perPage: 25, total: 1 }
    })
    expect(text).not.toContain("Covered by the Acme NDA")
    expect(text).not.toContain("portal-bearer-secret")
  })

  test("returns one client's detail and still omits its notes", async () => {
    const { token } = await makeCaller("accountant", ["clients:read"])
    const client = await makeClient({ notes: "Private note" })
    const { GET } = await import("@/app/api/v1/clients/[id]/route")

    const response = await GET(apiRequest(`/api/v1/clients/${client.id}`, token.token), {
      params: Promise.resolve({ id: client.id })
    })
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(JSON.parse(text).data.id).toBe(client.id)
    expect(text).not.toContain("Private note")
  })

  test("returns an invoice with its line items and without its public bearer token", async () => {
    const { token } = await makeCaller("owner", ["invoices:read"])
    const invoice = await makeInvoice()
    const { GET } = await import("@/app/api/v1/invoices/[id]/route")

    const response = await GET(apiRequest(`/api/v1/invoices/${invoice.id}`, token.token), {
      params: Promise.resolve({ id: invoice.id })
    })
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(JSON.parse(text).data.lineItems).toEqual([])
    expect(text).not.toContain(String(invoice.publicToken))
  })

  test("answers a malformed id and an unknown id with the same not-found", async () => {
    const { token } = await makeCaller("owner", ["clients:read"])
    const { GET } = await import("@/app/api/v1/clients/[id]/route")

    const malformed = await GET(apiRequest("/api/v1/clients/nope", token.token), {
      params: Promise.resolve({ id: "nope" })
    })
    const unknown = await GET(apiRequest("/api/v1/clients/x", token.token), {
      params: Promise.resolve({ id: "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c" })
    })

    expect(malformed.status).toBe(404)
    expect(await malformed.json()).toEqual(await unknown.json())
  })

  test("refuses an unsupported query parameter and a page size over the limit", async () => {
    const { token } = await makeCaller("owner", ["clients:read"])

    const filtered = await getClients("/api/v1/clients?status=deleted", token.token)
    const oversized = await getClients("/api/v1/clients?perPage=1000", token.token)

    expect(filtered.status).toBe(400)
    expect(oversized.status).toBe(400)
  })

  test("serves the OpenAPI document to any live token whatever its scopes", async () => {
    const { token } = await makeCaller("assistant", ["expenses:read"])
    const { GET } = await import("@/app/api/v1/openapi.json/route")

    const response = await GET(apiRequest("/api/v1/openapi.json", token.token))

    expect(response.status).toBe(200)
    expect((await response.json()).openapi).toBe("3.1.0")
  })
})

describe("public API token enforcement", () => {
  test("answers a token lacking the scope exactly as it answers an unknown or absent one", async () => {
    const { token } = await makeCaller("owner", ["clients:read"])
    const { GET } = await import("@/app/api/v1/invoices/route")

    const outOfScope = await GET(apiRequest("/api/v1/invoices", token.token))
    const unknown = await GET(apiRequest("/api/v1/invoices", issueApiToken().token))
    const absent = await GET(apiRequest("/api/v1/invoices"))

    expect(outOfScope.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(absent.status).toBe(401)
    expect(await outOfScope.json()).toEqual(await unknown.json())
  })

  test("refuses a revoked token on the very next request", async () => {
    const { token } = await makeCaller("owner", ["clients:read"])

    const before = await getClients("/api/v1/clients", token.token)

    await database
      .update(apiTokens)
      .set({ revokedAt: new Date() })
      .where(eq(apiTokens.id, token.id))

    const after = await getClients("/api/v1/clients", token.token)

    expect(before.status).toBe(200)
    expect(after.status).toBe(401)
  })

  test("refuses a token whose expiry has passed", async () => {
    const user = await makeUser()
    const organization = await makeOrganization()

    await makeMember({ userId: user.id, organizationId: organization.id, role: "owner" })

    const token = await makeApiToken({
      createdByUserId: user.id,
      expiresAt: new Date(Date.now() - 1000)
    })

    const response = await getClients("/api/v1/clients", token.token)

    expect(response.status).toBe(401)
  })

  test("stops every token of a creator whose membership is removed", async () => {
    const { user, token } = await makeCaller("accountant", ["clients:read"])

    await database.delete(members).where(eq(members.userId, user.id))

    const response = await getClients("/api/v1/clients", token.token)

    expect(response.status).toBe(401)
  })

  test("keys the rate limit on the token once the token is known", async () => {
    const { token } = await makeCaller("owner", ["clients:read"])

    await getClients("/api/v1/clients", token.token)

    const keys = mocks.consume.mock.calls.map(([key]) => key)

    expect(keys).toEqual([expect.stringMatching(/^api\.v1\.ip:/), `api.v1.token:${token.id}`])
  })

  test("answers 429 when the token has spent its allowance", async () => {
    const { token } = await makeCaller("owner", ["clients:read"])

    mocks.consume
      .mockResolvedValueOnce({ allowed: true, remaining: 10, resetAt: new Date() })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: new Date() })

    const response = await getClients("/api/v1/clients", token.token)

    expect(response.status).toBe(429)
    expect((await response.json()).error.code).toBe("rate_limited")
  })

  test("records when a token was last used", async () => {
    const { token } = await makeCaller("owner", ["clients:read"])

    await getClients("/api/v1/clients", token.token)

    const [row] = await database.select().from(apiTokens).where(eq(apiTokens.id, token.id))

    expect(row?.lastUsedAt).toBeInstanceOf(Date)
  })
})
