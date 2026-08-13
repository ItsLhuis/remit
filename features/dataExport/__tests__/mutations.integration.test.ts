import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, dataExports } from "@/database/schema"

import { makeClient, makeDataExport, makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  enqueueJob: vi.fn(),
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

// The queue is stubbed at the module boundary: the request path's job is to persist the row and hand
// the id to the queue, and the assembly it triggers is exercised in `export.integration.test.ts`.
vi.mock("@/lib/jobs", () => ({
  enqueueJob: mocks.enqueueJob,
  registerJobHandler: vi.fn()
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-0000000005a1"

// One entry per test: `tests/integration/setup.ts` truncates `audit_logs` before each one, so the
// first row is the one the action under test wrote.
async function listAuditEntries() {
  return await database.select().from(auditLogs)
}

describe("requestDataExport", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: "owner-export@example.com", name: "Ada Owner" })

    mocks.headers.mockResolvedValue(
      new Headers({ "user-agent": "Vitest", "x-forwarded-for": "203.0.113.7" })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, name: "Ada Owner" } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("queues an instance export and records the request in the audit log", async () => {
    const { requestDataExport } = await import("../mutations")

    const result = await requestDataExport({ scope: "instance", clientId: null })

    if ("error" in result) throw new Error(`Expected success, got ${result.error}`)

    const [row] = await database.select().from(dataExports)

    expect(row).toEqual(
      expect.objectContaining({
        id: result.data.exportId,
        scope: "instance",
        clientId: null,
        status: "pending",
        progress: 0,
        requestedByUserId: ownerId
      })
    )

    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      "data_export.assemble",
      { exportId: result.data.exportId },
      { jobId: `data_export.assemble.${result.data.exportId}` }
    )

    const [audit] = await listAuditEntries()

    expect(audit).toEqual(
      expect.objectContaining({
        event: "data_export.requested",
        actorUserId: ownerId,
        actorRole: "owner",
        targetEntityType: "data_export",
        targetEntityId: result.data.exportId,
        ipAddress: "203.0.113.7",
        userAgent: "Vitest"
      })
    )
    expect(audit?.metadata).toEqual({
      exportId: result.data.exportId,
      scope: "instance",
      clientId: null
    })

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/data")
  })

  test("targets the client in the audit entry of a client-scoped export", async () => {
    const client = await makeClient({ name: "Acme" })

    const { requestDataExport } = await import("../mutations")

    const result = await requestDataExport({ scope: "client", clientId: client.id })

    if ("error" in result) throw new Error(`Expected success, got ${result.error}`)

    const [audit] = await listAuditEntries()

    expect(audit).toEqual(
      expect.objectContaining({
        targetEntityType: "client",
        targetEntityId: client.id
      })
    )
    expect(audit?.metadata).toEqual({
      exportId: result.data.exportId,
      scope: "client",
      clientId: client.id
    })
  })

  test("refuses an unauthenticated caller", async () => {
    mocks.getSession.mockResolvedValue(null)

    const { requestDataExport } = await import("../mutations")

    const result = await requestDataExport({ scope: "instance", clientId: null })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await database.select().from(dataExports)).toEqual([])
    expect(mocks.enqueueJob).not.toHaveBeenCalled()
  })

  test("refuses a role that is not the owner", async () => {
    mocks.getCurrentRole.mockResolvedValue("accountant")

    const { requestDataExport } = await import("../mutations")

    const result = await requestDataExport({ scope: "instance", clientId: null })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await database.select().from(dataExports)).toEqual([])
  })

  test("refuses a client export with no client selected", async () => {
    const { requestDataExport } = await import("../mutations")

    const result = await requestDataExport({ scope: "client", clientId: null })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await database.select().from(dataExports)).toEqual([])
  })

  test("refuses a client export for a client that does not exist", async () => {
    const { requestDataExport } = await import("../mutations")

    const result = await requestDataExport({
      scope: "client",
      clientId: "00000000-0000-4000-8000-0000000005ff"
    })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await database.select().from(dataExports)).toEqual([])
  })

  test("refuses a second export while one is still in flight", async () => {
    await makeDataExport({ status: "running", requestedByUserId: ownerId })

    const { requestDataExport } = await import("../mutations")

    const result = await requestDataExport({ scope: "instance", clientId: null })

    expect(result).toEqual({ error: expect.any(String) })
    expect(await database.select().from(dataExports)).toHaveLength(1)
    expect(mocks.enqueueJob).not.toHaveBeenCalled()
  })

  test("allows a new export once the previous one has finished", async () => {
    await makeDataExport({ status: "ready", requestedByUserId: ownerId })

    const { requestDataExport } = await import("../mutations")

    const result = await requestDataExport({ scope: "instance", clientId: null })

    expect(result).toEqual({ data: { exportId: expect.any(String) } })
    expect(await database.select().from(dataExports)).toHaveLength(2)
  })
})
