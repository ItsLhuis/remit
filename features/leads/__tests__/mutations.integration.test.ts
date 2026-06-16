import { beforeEach, describe, expect, test, vi } from "vitest"

import { eq, isNull } from "drizzle-orm"

import { auditLogs, clients, leads } from "@/database/schema"

import { database } from "@/tests/integration/database"
import { makeClient, makeLead, makeUser } from "@/tests/factories"

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

const ownerId = "00000000-0000-4000-8000-000000000801"
const ownerEmail = "owner-leads@example.com"

const validLead = {
  firstName: "Jane",
  lastName: "Doe",
  company: "Acme Studio",
  email: "jane@example.com",
  phone: "+15550100",
  source: "Referral",
  notes: "Met at a conference",
  lostReason: "",
  status: "new" as const
}

describe("lead mutations", () => {
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

  test("creates a lead and audits the creation", async () => {
    const { createLead } = await import("../mutations")

    const result = await createLead(validLead)
    const [leadRow] = await database.select().from(leads)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: { lead: expect.objectContaining({ firstName: "Jane", email: "jane@example.com" }) }
    })
    expect(leadRow).toEqual(
      expect.objectContaining({ firstName: "Jane", status: "new", deletedAt: null })
    )
    expect(auditRows[0]?.event).toBe("lead.created")
    expect(auditRows[0]?.targetEntityType).toBe("lead")
    expect(mocks.emit).toHaveBeenCalledWith("lead.created", {
      leadId: leadRow?.id,
      userId: ownerId
    })
  })

  test("advances a lead through an allowed stage transition", async () => {
    const { updateLeadStatus } = await import("../mutations")

    const lead = await makeLead({ email: "stage@example.com", status: "new" })

    const result = await updateLeadStatus({ id: lead.id, status: "contacted" })
    const [leadRow] = await database.select().from(leads).where(eq(leads.id, lead.id))

    expect("data" in result).toBe(true)
    expect(leadRow?.status).toBe("contacted")
    expect(mocks.emit).toHaveBeenCalledWith("lead.stage_changed", {
      leadId: lead.id,
      userId: ownerId,
      from: "new",
      to: "contacted"
    })
  })

  test("rejects a stage transition that the state machine disallows", async () => {
    const { updateLeadStatus } = await import("../mutations")

    const lead = await makeLead({ email: "invalid@example.com", status: "new" })

    const result = await updateLeadStatus({ id: lead.id, status: "won" })
    const [leadRow] = await database.select().from(leads).where(eq(leads.id, lead.id))

    expect(result).toEqual({ error: "That stage change is not allowed" })
    expect(leadRow?.status).toBe("new")
    expect(mocks.emit).not.toHaveBeenCalledWith("lead.stage_changed", expect.anything())
  })

  test("converts a lead into a client through the clients feature boundary", async () => {
    const { convertLeadToClient } = await import("../mutations")

    const lead = await makeLead({ email: "convert@example.com", status: "qualified" })

    const result = await convertLeadToClient({
      id: lead.id,
      name: "Converted Client",
      currency: "EUR"
    })

    expect("data" in result).toBe(true)

    if ("error" in result) throw new Error(result.error)

    const clientId = result.data.clientId
    const [clientRow] = await database.select().from(clients).where(eq(clients.id, clientId))
    const [leadRow] = await database.select().from(leads).where(eq(leads.id, lead.id))
    const convertedEvents = mocks.emit.mock.calls.filter(([name]) => name === "lead.converted")

    expect(clientRow).toEqual(
      expect.objectContaining({ name: "Converted Client", email: "convert@example.com" })
    )
    expect(leadRow?.convertedToClientId).toBe(clientId)
    expect(leadRow?.convertedAt).not.toBeNull()
    expect(convertedEvents).toHaveLength(1)
    expect(mocks.emit).toHaveBeenCalledWith("lead.converted", {
      leadId: lead.id,
      userId: ownerId,
      clientId
    })
  })

  test("refuses to convert a lead that is already converted", async () => {
    const { convertLeadToClient } = await import("../mutations")

    const client = await makeClient({ name: "Existing", email: "existing@example.com" })
    const lead = await makeLead({
      email: "already@example.com",
      convertedAt: new Date(),
      convertedToClientId: client.id
    })

    const result = await convertLeadToClient({
      id: lead.id,
      name: "Should Not Convert",
      currency: "EUR"
    })

    expect(result).toEqual({ error: "This lead has already been converted" })
  })

  test("soft deletes a lead and hides it from normal list queries", async () => {
    const { softDeleteLead } = await import("../mutations")
    const { listLeads } = await import("../queries")
    const { parseLeadListQuery } = await import("../schemas")

    const lead = await makeLead({ email: "delete@example.com" })

    const result = await softDeleteLead({ id: lead.id })
    const activeRows = await database.select().from(leads).where(isNull(leads.deletedAt))
    const list = await listLeads(parseLeadListQuery({}))

    expect(result).toEqual({ data: { id: lead.id } })
    expect(activeRows).toHaveLength(0)
    expect(list.rows).toHaveLength(0)
    expect(mocks.emit).toHaveBeenCalledWith("lead.deleted", { leadId: lead.id, userId: ownerId })
  })

  test("prevents assistants from deleting leads", async () => {
    const { softDeleteLead } = await import("../mutations")

    const lead = await makeLead({ email: "keep@example.com" })
    mocks.getCurrentRole.mockResolvedValueOnce("assistant")

    const result = await softDeleteLead({ id: lead.id })
    const activeRows = await database.select().from(leads).where(isNull(leads.deletedAt))

    expect(result).toEqual({ error: "You do not have permission to do that" })
    expect(activeRows).toHaveLength(1)
  })
})
