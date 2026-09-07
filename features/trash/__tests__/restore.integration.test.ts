import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, clients, invoices, projects } from "@/database/schema"

import { makeClient, makeInvoice, makeProject, makeUser } from "@/tests/factories"
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
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000801"
const ownerEmail = "owner-trash@example.com"

const deletedAt = new Date("2026-05-01T10:00:00.000Z")

describe("restoring deleted records", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("brings a deleted client back into the list reads and audits the restore", async () => {
    const { restoreTrashedRecord } = await import("../mutations")

    const client = await makeClient({ deletedAt })

    const result = await restoreTrashedRecord({ kind: "client", id: client.id })
    const [restored] = await database.select().from(clients).where(eq(clients.id, client.id))
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({ data: { id: client.id } })
    expect(restored?.deletedAt).toBeNull()
    expect(auditRows.map((row) => row.event)).toContain("client.restored")
  })

  test("refuses to restore an invoice whose client is still deleted", async () => {
    const { restoreTrashedRecord } = await import("../mutations")

    const client = await makeClient({ deletedAt })
    const invoice = await makeInvoice({ clientId: client.id, deletedAt })

    const result = await restoreTrashedRecord({ kind: "invoice", id: invoice.id })
    const [unchanged] = await database.select().from(invoices).where(eq(invoices.id, invoice.id))

    expect(result).toEqual({ error: expect.stringContaining("Restore the") })
    expect(unchanged?.deletedAt).not.toBeNull()
  })

  test("refuses to restore a project whose client is still deleted", async () => {
    const { restoreTrashedRecord } = await import("../mutations")

    const client = await makeClient({ deletedAt })
    const project = await makeProject({ clientId: client.id, deletedAt })

    const result = await restoreTrashedRecord({ kind: "project", id: project.id })
    const [unchanged] = await database.select().from(projects).where(eq(projects.id, project.id))

    expect(result).toEqual({ error: expect.stringContaining("Restore the") })
    expect(unchanged?.deletedAt).not.toBeNull()
  })

  test("restores a child once its parent is live again", async () => {
    const { restoreTrashedRecord } = await import("../mutations")

    const client = await makeClient({ deletedAt })
    const project = await makeProject({ clientId: client.id, deletedAt })

    await restoreTrashedRecord({ kind: "client", id: client.id })

    const result = await restoreTrashedRecord({ kind: "project", id: project.id })
    const [restored] = await database.select().from(projects).where(eq(projects.id, project.id))

    expect(result).toEqual({ data: { id: project.id } })
    expect(restored?.deletedAt).toBeNull()
  })

  test("refuses a restore for a role that cannot delete", async () => {
    const { restoreTrashedRecord } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const client = await makeClient({ deletedAt })

    const result = await restoreTrashedRecord({ kind: "client", id: client.id })
    const [unchanged] = await database.select().from(clients).where(eq(clients.id, client.id))

    expect(result).toEqual({ error: expect.any(String) })
    expect(unchanged?.deletedAt).not.toBeNull()
  })
})
