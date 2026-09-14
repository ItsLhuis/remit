import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { hashApiToken } from "@/lib/apiToken"

import { apiTokens, auditLogs } from "@/database/schema"

import { makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  revalidatePath: vi.fn()
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

vi.mock("next/headers", () => ({ headers: mocks.headers }))

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }))

vi.mock("@/lib/auth/session", () => ({ getCurrentRole: mocks.getCurrentRole }))

let userId: string

beforeEach(async () => {
  vi.clearAllMocks()

  const user = await makeUser()

  userId = user.id

  mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
  mocks.getSession.mockResolvedValue({ user: { id: user.id } })
  mocks.getCurrentRole.mockResolvedValue("owner")
})

describe("API token settings", () => {
  test("shows the new token once and stores only its hash", async () => {
    const { createApiToken } = await import("../mutations")

    const result = await createApiToken({
      name: "Accounting export",
      scopes: ["invoices:read"],
      expiry: "90"
    })

    if ("error" in result) throw new Error(result.error)

    const [row] = await database.select().from(apiTokens)

    expect(result.data.secret.startsWith("remit_")).toBe(true)
    expect(row?.tokenHash).toBe(hashApiToken(result.data.secret))
    expect(JSON.stringify(row)).not.toContain(result.data.secret)
    expect(row?.createdByUserId).toBe(userId)
  })

  test("audits creation without the token appearing anywhere in the entry", async () => {
    const { createApiToken } = await import("../mutations")

    const result = await createApiToken({
      name: "Script",
      scopes: ["clients:read"],
      expiry: "never"
    })

    if ("error" in result) throw new Error(result.error)

    const [entry] = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "api_token.created"))

    expect(entry?.actorUserId).toBe(userId)
    expect(JSON.stringify(entry)).not.toContain(result.data.secret)
  })

  test("refuses a role other than the owner and mints nothing", async () => {
    mocks.getCurrentRole.mockResolvedValue("accountant")

    const { createApiToken } = await import("../mutations")

    const result = await createApiToken({ name: "Script", scopes: ["clients:read"], expiry: "30" })

    expect("error" in result).toBe(true)
    expect(await database.select().from(apiTokens)).toHaveLength(0)
  })

  test("revokes a token once and answers a second revocation without a second audit entry", async () => {
    const { createApiToken, revokeApiToken } = await import("../mutations")

    const created = await createApiToken({ name: "Script", scopes: ["clients:read"], expiry: "30" })

    if ("error" in created) throw new Error(created.error)

    const first = await revokeApiToken({ tokenId: created.data.token.id })
    const second = await revokeApiToken({ tokenId: created.data.token.id })

    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "api_token.revoked"))

    expect("data" in first && first.data.token.status).toBe("revoked")
    expect("data" in second && second.data.token.status).toBe("revoked")
    expect(entries).toHaveLength(1)
  })
})
