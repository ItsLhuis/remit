import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, settings } from "@/database/schema"

import { makeSettings, makeUser } from "@/tests/factories"
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

async function readMcpEnabled(): Promise<boolean | undefined> {
  const [row] = await database.select({ mcpEnabled: settings.mcpEnabled }).from(settings)

  return row?.mcpEnabled
}

describe("MCP server setting", () => {
  test("starts off on a new instance", async () => {
    await makeSettings()

    expect(await readMcpEnabled()).toBe(false)
  })

  test("lets the owner turn it on and records who did", async () => {
    const settingsRow = await makeSettings()
    const { setMcpEnabled } = await import("../mutations")

    const result = await setMcpEnabled({ enabled: true })
    const [entry] = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "settings.mcp.updated"))

    expect(result).toEqual({ data: { enabled: true } })
    expect(await readMcpEnabled()).toBe(true)
    expect(entry).toMatchObject({
      actorUserId: userId,
      actorRole: "owner",
      targetEntityType: "settings",
      targetEntityId: settingsRow.id,
      metadata: { enabled: true }
    })
  })

  test("turns it off again", async () => {
    await makeSettings({ mcpEnabled: true })
    const { setMcpEnabled } = await import("../mutations")

    const result = await setMcpEnabled({ enabled: false })

    expect(result).toEqual({ data: { enabled: false } })
    expect(await readMcpEnabled()).toBe(false)
  })

  test("writes and records nothing when the value is already what was asked for", async () => {
    await makeSettings({ mcpEnabled: true })
    const { setMcpEnabled } = await import("../mutations")

    await setMcpEnabled({ enabled: true })
    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "settings.mcp.updated"))

    expect(entries).toEqual([])
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  test.each(["accountant", "assistant"])("refuses the %s role", async (role) => {
    await makeSettings()
    mocks.getCurrentRole.mockResolvedValue(role)
    const { setMcpEnabled } = await import("../mutations")

    const result = await setMcpEnabled({ enabled: true })

    expect(result).toHaveProperty("error")
    expect(await readMcpEnabled()).toBe(false)
  })

  test("refuses a request with no session", async () => {
    await makeSettings()
    mocks.getSession.mockResolvedValue(null)
    const { setMcpEnabled } = await import("../mutations")

    const result = await setMcpEnabled({ enabled: true })

    expect(result).toHaveProperty("error")
    expect(await readMcpEnabled()).toBe(false)
  })

  test("refuses anything but a yes or a no", async () => {
    await makeSettings()
    const { setMcpEnabled } = await import("../mutations")

    const result = await setMcpEnabled({ enabled: "yes" })

    expect(result).toHaveProperty("error")
  })
})
