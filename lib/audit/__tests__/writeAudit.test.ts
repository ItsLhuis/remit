import { beforeEach, describe, expect, test, vi } from "vitest"

const values = vi.fn().mockResolvedValue(undefined)
const insert = vi.fn().mockReturnValue({ values })

vi.mock("@/database", () => ({
  database: { insert }
}))

vi.mock("@/database/schema", () => ({
  auditLogs: "auditLogsTable"
}))

describe("writeAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    values.mockResolvedValue(undefined)
    insert.mockReturnValue({ values })
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

    expect(insert).toHaveBeenCalledOnce()
    expect(insert).toHaveBeenCalledWith("auditLogsTable")
    expect(values).toHaveBeenCalledWith({
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
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    values.mockRejectedValueOnce(new Error("DB down"))

    const { writeAudit } = await import("../index")

    await expect(writeAudit("auth.login.failed")).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })
})
