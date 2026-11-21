import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const values = vi.fn().mockResolvedValue(undefined)

  return {
    values,
    insert: vi.fn().mockReturnValue({ values }),
    loggerError: vi.fn()
  }
})

vi.mock("@/database", () => ({
  database: { insert: mocks.insert }
}))

vi.mock("@/database/schema", () => ({
  auditLogs: "auditLogsTable"
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError
  }
}))

describe("writeAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.values.mockResolvedValue(undefined)
    mocks.insert.mockReturnValue({ values: mocks.values })
  })

  test("inserts a row with the provided event and options", async () => {
    const { writeAudit } = await import("../index")

    await writeAudit("auth.login.succeeded", {
      actorUserId: "00000000-0000-0000-0000-000000000001",
      actorRole: "owner",
      targetEntityType: "user",
      targetEntityId: "00000000-0000-0000-0000-000000000002",
      metadata: { email: "owner@example.com" },
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0"
    })

    expect(mocks.insert).toHaveBeenCalledOnce()
    expect(mocks.insert).toHaveBeenCalledWith("auditLogsTable")
    expect(mocks.values).toHaveBeenCalledWith({
      event: "auth.login.succeeded",
      actorUserId: "00000000-0000-0000-0000-000000000001",
      actorRole: "owner",
      targetEntityType: "user",
      targetEntityId: "00000000-0000-0000-0000-000000000002",
      metadata: { email: "owner@example.com" },
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0"
    })
  })

  test("does not throw when the database insert fails", async () => {
    mocks.values.mockRejectedValueOnce(new Error("DB down"))

    const { writeAudit } = await import("../index")

    await expect(writeAudit("auth.login.failed")).resolves.toBeUndefined()
    expect(mocks.loggerError).toHaveBeenCalledOnce()
  })
})
