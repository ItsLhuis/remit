import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, clients } from "@/database/schema"

import { makeClient, makeSettings, makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, fatal: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

const ownerId = "00000000-0000-4000-8000-0000000004d1"

async function readPortalToken(clientId: string) {
  const row = await database.query.clients.findFirst({ where: eq(clients.id, clientId) })

  return row?.portalToken ?? null
}

describe("client portal link lifecycle", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: "owner-portal-link@example.com" })
    await makeSettings({ businessName: "Studio Remit" })

    mocks.headers.mockResolvedValue(
      new Headers({ "user-agent": "Vitest", "x-forwarded-for": "203.0.113.50" })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("mints a portal token for a client that has none", async () => {
    const { rotateClientPortalLink } = await import("../mutations")

    const client = await makeClient()

    expect(await readPortalToken(client.id)).toBeNull()

    await rotateClientPortalLink({ id: client.id })

    expect(await readPortalToken(client.id)).toHaveLength(43)
  })

  test("replaces the token on a second rotation and clears it on a revoke", async () => {
    const { revokeClientPortalLink, rotateClientPortalLink } = await import("../mutations")

    const client = await makeClient()

    await rotateClientPortalLink({ id: client.id })

    const firstToken = await readPortalToken(client.id)

    await rotateClientPortalLink({ id: client.id })

    const secondToken = await readPortalToken(client.id)

    expect(secondToken).not.toBe(firstToken)

    await revokeClientPortalLink({ id: client.id })

    expect(await readPortalToken(client.id)).toBeNull()
  })

  test("refuses to revoke a portal that was never enabled", async () => {
    const { revokeClientPortalLink } = await import("../mutations")

    const client = await makeClient()

    const result = await revokeClientPortalLink({ id: client.id })

    expect("error" in result).toBe(true)
  })

  test("withdraws the portal when the client is soft-deleted, and refuses to re-enable it", async () => {
    const { rotateClientPortalLink, softDeleteClient } = await import("../mutations")

    const client = await makeClient()

    await rotateClientPortalLink({ id: client.id })
    await softDeleteClient({ id: client.id })

    expect(await readPortalToken(client.id)).toBeNull()

    const result = await rotateClientPortalLink({ id: client.id })

    expect("error" in result).toBe(true)
    expect(await readPortalToken(client.id)).toBeNull()
  })

  test("refuses a role below owner and leaves the portal untouched", async () => {
    const { rotateClientPortalLink } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const client = await makeClient()

    const result = await rotateClientPortalLink({ id: client.id })

    expect("error" in result).toBe(true)
    expect(await readPortalToken(client.id)).toBeNull()
  })

  test("audits both actions without recording any token material", async () => {
    const { revokeClientPortalLink, rotateClientPortalLink } = await import("../mutations")

    const client = await makeClient()

    await rotateClientPortalLink({ id: client.id })

    const issuedToken = await readPortalToken(client.id)

    await revokeClientPortalLink({ id: client.id })

    const rows = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetEntityId, client.id))

    const events = rows.map((row) => row.event)

    expect(events).toContain("client.portal_link.rotated")
    expect(events).toContain("client.portal_link.revoked")
    expect(JSON.stringify(rows)).not.toContain(issuedToken)
  })
})
