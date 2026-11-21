import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { activityLogs, auditLogs } from "@/database/schema"

import { makeActivityLog, makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
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
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole,
  getSession: mocks.getSession
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-0000000000a1"

beforeEach(async () => {
  vi.clearAllMocks()

  await makeUser({ id: ownerId, email: "owner-activity@example.com" })

  mocks.headers.mockResolvedValue(new Headers({ "user-agent": "vitest" }))
  mocks.getSession.mockResolvedValue({ user: { id: ownerId } })
  mocks.getCurrentRole.mockResolvedValue("owner")
})

describe("markActivityRead", () => {
  test("stamps the selected entries as read", async () => {
    const { markActivityRead } = await import("../mutations")
    const first = await makeActivityLog()
    const second = await makeActivityLog()
    const untouched = await makeActivityLog()

    const result = await markActivityRead({ ids: [first.id, second.id] })

    expect(result).toEqual({ data: { count: 2 } })

    const rows = await database.select().from(activityLogs)

    expect(rows.filter((row) => row.readAt !== null)).toHaveLength(2)
    expect(rows.find((row) => row.id === untouched.id)?.readAt).toBeNull()
  })

  test("rejects a selection that is not a list of ids", async () => {
    const { markActivityRead } = await import("../mutations")

    const result = await markActivityRead({ ids: ["nope"] })

    expect(result).toEqual({ error: expect.any(String) })
  })

  test("refuses an unauthenticated caller", async () => {
    const { markActivityRead } = await import("../mutations")

    mocks.getSession.mockResolvedValue(null)

    const result = await markActivityRead({ ids: [crypto.randomUUID()] })

    expect(result).toEqual({ error: expect.any(String) })
  })
})

describe("markAllActivityRead", () => {
  test("stamps every unread entry and leaves already-read ones alone", async () => {
    const { markAllActivityRead } = await import("../mutations")
    const alreadyRead = await makeActivityLog({ readAt: new Date("2026-01-01T00:00:00.000Z") })

    await makeActivityLog()
    await makeActivityLog()

    const result = await markAllActivityRead()

    expect(result).toEqual({ data: { count: 2 } })

    const [row] = await database
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.id, alreadyRead.id))

    expect(row?.readAt).toEqual(new Date("2026-01-01T00:00:00.000Z"))
  })

  test("is granted to an assistant", async () => {
    const { markAllActivityRead } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    await makeActivityLog()

    expect(await markAllActivityRead()).toEqual({ data: { count: 1 } })
  })
})

describe("deleteActivity", () => {
  test("removes the entry and records the removal in the audit log", async () => {
    const { deleteActivity } = await import("../mutations")
    const entry = await makeActivityLog()

    const result = await deleteActivity({ id: entry.id })

    expect(result).toEqual({ data: { id: entry.id } })
    expect(await database.select().from(activityLogs)).toHaveLength(0)

    const [audit] = await database.select().from(auditLogs)

    expect(audit).toMatchObject({
      event: "activity.deleted",
      actorUserId: ownerId,
      targetEntityType: "activity_log",
      targetEntityId: entry.id
    })
  })

  test("refuses a role other than the owner", async () => {
    const { deleteActivity } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("accountant")

    const entry = await makeActivityLog()
    const result = await deleteActivity({ id: entry.id })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await database.select().from(activityLogs)).toHaveLength(1)
  })

  test("reports not found for an entry that no longer exists", async () => {
    const { deleteActivity } = await import("../mutations")

    const result = await deleteActivity({ id: crypto.randomUUID() })

    expect(result).toEqual({ error: expect.any(String) })
  })
})
