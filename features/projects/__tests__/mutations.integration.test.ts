import { eq, isNull } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, projects } from "@/database/schema"

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
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000901"
const ownerEmail = "owner-projects@example.com"

describe("project mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail }
    })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("creates a project with the client currency and integer-cent budget", async () => {
    const { createProject } = await import("../mutations")

    const client = await makeClient({ currency: "USD", email: "create@example.com" })

    const result = await createProject({
      clientId: client.id,
      name: "Website redesign",
      budget: "1500.00",
      hourlyRate: "90",
      startDate: "2026-01-01",
      endDate: "2026-06-01",
      description: "Full rebuild",
      status: "active"
    })
    const [projectRow] = await database.select().from(projects)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: { project: expect.objectContaining({ name: "Website redesign", budget: "1500.00" }) }
    })
    expect(projectRow).toEqual(
      expect.objectContaining({
        name: "Website redesign",
        status: "active",
        currency: "USD",
        budgetCents: 150000,
        hourlyRateCents: 9000,
        deletedAt: null
      })
    )
    expect(auditRows[0]?.event).toBe("project.created")
    expect(auditRows[0]?.targetEntityType).toBe("project")
    expect(mocks.emit).toHaveBeenCalledWith("project.created", {
      projectId: projectRow?.id,
      userId: ownerId
    })
  })

  test("updates a project and re-derives currency from the assigned client", async () => {
    const { updateProject } = await import("../mutations")

    const client = await makeClient({ currency: "EUR", email: "update@example.com" })
    const project = await makeProject({ clientId: client.id, name: "Old name" })

    const result = await updateProject({
      id: project.id,
      clientId: client.id,
      name: "New name",
      budget: "2000",
      hourlyRate: "",
      startDate: "",
      endDate: "",
      description: ""
    })
    const [projectRow] = await database.select().from(projects).where(eq(projects.id, project.id))

    expect("data" in result).toBe(true)
    expect(projectRow?.name).toBe("New name")
    expect(projectRow?.budgetCents).toBe(200000)
    expect(projectRow?.currency).toBe("EUR")
  })

  test("refuses to move a project with financial records to another client", async () => {
    const { updateProject } = await import("../mutations")

    const client = await makeClient({ email: "owner-of-project@example.com" })
    const otherClient = await makeClient({ email: "poacher@example.com" })
    const project = await makeProject({ clientId: client.id, name: "Booked" })

    await makeInvoice({ projectId: project.id })

    const result = await updateProject({
      id: project.id,
      clientId: otherClient.id,
      name: "Booked",
      budget: "",
      hourlyRate: "",
      startDate: "",
      endDate: "",
      description: ""
    })

    // The action's translated message, never the `fk_invoices_project_client` violation the write
    // would have raised one statement later.
    expect(result).toEqual({
      error:
        "This project already has invoices, expenses, contracts, recurring schedules, or proposals, so it cannot be moved to another client"
    })

    const [projectRow] = await database.select().from(projects).where(eq(projects.id, project.id))

    expect(projectRow?.clientId).toBe(client.id)
  })

  test("moves a project with no financial records to another client", async () => {
    const { updateProject } = await import("../mutations")

    const client = await makeClient({ email: "before@example.com" })
    const otherClient = await makeClient({ currency: "USD", email: "after@example.com" })
    const project = await makeProject({ clientId: client.id, name: "Unbooked" })

    const result = await updateProject({
      id: project.id,
      clientId: otherClient.id,
      name: "Unbooked",
      budget: "",
      hourlyRate: "",
      startDate: "",
      endDate: "",
      description: ""
    })

    expect("data" in result).toBe(true)

    const [projectRow] = await database.select().from(projects).where(eq(projects.id, project.id))

    expect(projectRow?.clientId).toBe(otherClient.id)
  })

  test("advances a project through an allowed status transition", async () => {
    const { updateProjectStatus } = await import("../mutations")

    const project = await makeProject({ status: "active" })

    const result = await updateProjectStatus({ id: project.id, status: "on_hold" })
    const [projectRow] = await database.select().from(projects).where(eq(projects.id, project.id))

    expect("data" in result).toBe(true)
    expect(projectRow?.status).toBe("on_hold")
    expect(mocks.emit).toHaveBeenCalledWith("project.status_changed", {
      projectId: project.id,
      userId: ownerId,
      from: "active",
      to: "on_hold"
    })
  })

  test("rejects a status transition that the state machine disallows", async () => {
    const { updateProjectStatus } = await import("../mutations")

    const project = await makeProject({ status: "completed" })

    const result = await updateProjectStatus({ id: project.id, status: "active" })
    const [projectRow] = await database.select().from(projects).where(eq(projects.id, project.id))

    expect(result).toEqual({ error: "That status change is not allowed" })
    expect(projectRow?.status).toBe("completed")
    expect(mocks.emit).not.toHaveBeenCalledWith("project.status_changed", expect.anything())
  })

  test("soft deletes a project and hides it from normal list queries", async () => {
    const { softDeleteProject } = await import("../mutations")
    const { listProjects } = await import("../queries")
    const { parseProjectListQuery } = await import("../schemas")

    const project = await makeProject({ name: "Doomed" })

    const result = await softDeleteProject({ id: project.id })
    const activeRows = await database.select().from(projects).where(isNull(projects.deletedAt))
    const list = await listProjects(parseProjectListQuery({}))

    expect(result).toEqual({ data: { id: project.id } })
    expect(activeRows).toHaveLength(0)
    expect(list.rows).toHaveLength(0)
    expect(mocks.emit).toHaveBeenCalledWith("project.deleted", {
      projectId: project.id,
      userId: ownerId
    })
  })

  test("prevents assistants from deleting projects", async () => {
    const { softDeleteProject } = await import("../mutations")

    const project = await makeProject({ name: "Protected" })
    mocks.getCurrentRole.mockResolvedValueOnce("assistant")

    const result = await softDeleteProject({ id: project.id })
    const activeRows = await database.select().from(projects).where(isNull(projects.deletedAt))

    expect(result).toEqual({ error: "You do not have permission to do that" })
    expect(activeRows).toHaveLength(1)
  })
})
