import { eq } from "drizzle-orm"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { mintPublicToken } from "@/lib/publicToken"

import { clients, projects } from "@/database/schema"

import {
  makeClient,
  makeContract,
  makeCreditNote,
  makeInvoice,
  makeProject,
  makeProposal,
  makeSettings
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

import { getClientPortal } from "../publicQueries"

const mocks = vi.hoisted(() => ({
  matchesPublicToken: vi.fn()
}))

vi.mock("@/lib/publicToken", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/publicToken")>()

  return {
    ...actual,
    matchesPublicToken: mocks.matchesPublicToken.mockImplementation(actual.matchesPublicToken)
  }
})

async function makePortalClient(overrides?: Record<string, unknown>) {
  const token = mintPublicToken()

  const client = await makeClient({
    name: "Northwind Ltd",
    email: "ops@northwind.test",
    notes: "Never mention the Contoso deal",
    portalToken: token,
    ...overrides
  })

  return { client, token }
}

// Only `Date` is faked: the Postgres client schedules real timers, and replacing those deadlocks the
// connection. The fixed instant sits after the seeded proposal's validity window opens and before it
// closes, so the expiry cases below are the only ones that lapse.
beforeEach(async () => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"))

  await makeSettings({
    businessName: "Studio Remit",
    businessEmail: "billing@studio.test",
    defaultLocale: "en",
    defaultTimezone: "UTC"
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("getClientPortal", () => {
  test("reports every kind of record the client holds", async () => {
    const { client, token } = await makePortalClient()
    const project = await makeProject({ clientId: client.id, name: "Website rebuild" })

    await makeInvoice({
      projectId: project.id,
      clientId: client.id,
      status: "sent",
      publicToken: mintPublicToken(),
      totalCents: 123400,
      dueDate: new Date("2026-07-31T00:00:00.000Z")
    })
    await makeProposal({
      projectId: project.id,
      clientId: client.id,
      status: "sent",
      issuedAt: new Date("2026-07-01T00:00:00.000Z"),
      validUntil: new Date("2026-08-01T00:00:00.000Z"),
      totalCents: 500000
    })
    await makeContract({
      clientId: client.id,
      status: "sent",
      issuedAt: new Date("2026-07-02T00:00:00.000Z")
    })

    const portal = await getClientPortal({ token })

    expect(portal?.clientName).toBe("Northwind Ltd")
    expect(portal?.issuer).toEqual({ name: "Studio Remit", email: "billing@studio.test" })
    expect(portal?.invoices).toHaveLength(1)
    expect(portal?.proposals).toHaveLength(1)
    expect(portal?.contracts).toHaveLength(1)
    expect(portal?.projects).toEqual([
      expect.objectContaining({ name: "Website rebuild", status: "active" })
    ])
  })

  test("renders every empty section for a client that holds nothing yet", async () => {
    const { token } = await makePortalClient()

    const portal = await getClientPortal({ token })

    expect(portal).toEqual(
      expect.objectContaining({
        outstanding: [],
        invoices: [],
        proposals: [],
        contracts: [],
        projects: []
      })
    )
  })

  test("never exposes an internal id, a bearer token, or the client's private notes", async () => {
    const { client, token } = await makePortalClient()
    const project = await makeProject({ clientId: client.id })
    const invoice = await makeInvoice({
      projectId: project.id,
      clientId: client.id,
      status: "sent",
      publicToken: mintPublicToken()
    })

    const serialized = JSON.stringify(await getClientPortal({ token }))

    expect(serialized).not.toContain(token)
    expect(serialized).not.toContain(client.id)
    expect(serialized).not.toContain(project.id)
    expect(serialized).not.toContain(invoice.id)
    expect(serialized).not.toContain("Contoso")
  })

  test("withholds every field the exposure decision excluded", async () => {
    const { client, token } = await makePortalClient({ phone: "+351 000 000 000" })

    await makeProject({
      clientId: client.id,
      description: "Renegotiate the retainer in Q4",
      budgetCents: 900000,
      hourlyRateCents: 12000
    })

    const portal = await getClientPortal({ token })
    const [portalProject] = portal?.projects ?? []

    expect(Object.keys(portal ?? {})).toEqual([
      "clientName",
      "issuer",
      "locale",
      "timeZone",
      "outstanding",
      "invoices",
      "proposals",
      "contracts",
      "projects"
    ])
    expect(Object.keys(portalProject ?? {})).toEqual(["name", "status", "startDate", "endDate"])
  })

  test("never offers a way into a contract, whichever state it is in", async () => {
    const { client, token } = await makePortalClient()
    const contractToken = mintPublicToken()

    await makeContract({
      clientId: client.id,
      status: "sent",
      issuedAt: new Date("2026-07-02T00:00:00.000Z"),
      publicToken: contractToken
    })

    const portal = await getClientPortal({ token })
    const [contract] = portal?.contracts ?? []

    expect(contract).not.toHaveProperty("documentPath")
    expect(JSON.stringify(portal)).not.toContain(contractToken)
  })
})

describe("getClientPortal isolation", () => {
  test("never reaches another client's records", async () => {
    const { client, token } = await makePortalClient()
    const other = await makeClient({ name: "Contoso GmbH", email: "ap@contoso.test" })
    const otherProject = await makeProject({ clientId: other.id, name: "Contoso intranet" })

    await makeInvoice({
      projectId: otherProject.id,
      clientId: other.id,
      status: "sent",
      number: "INV-CONTOSO-1",
      publicToken: mintPublicToken()
    })
    await makeProposal({
      projectId: otherProject.id,
      clientId: other.id,
      status: "sent",
      number: "PROP-CONTOSO-1",
      issuedAt: new Date("2026-07-01T00:00:00.000Z")
    })
    await makeContract({
      clientId: other.id,
      status: "sent",
      number: "CTR-CONTOSO-1",
      issuedAt: new Date("2026-07-01T00:00:00.000Z")
    })
    await makeProject({ clientId: client.id, name: "Website rebuild" })

    const portal = await getClientPortal({ token })

    expect(JSON.stringify(portal)).not.toContain("CONTOSO")
    expect(JSON.stringify(portal)).not.toContain("Contoso")
    expect(portal?.invoices).toEqual([])
    expect(portal?.proposals).toEqual([])
    expect(portal?.contracts).toEqual([])
    expect(portal?.projects).toEqual([
      expect.objectContaining({ name: "Website rebuild", status: "active" })
    ])
  })

  test("never carries a credit note raised against another client's invoice", async () => {
    const { client, token } = await makePortalClient()
    const other = await makeClient({ name: "Contoso GmbH", email: "ap@contoso.test" })

    const ownInvoice = await makeInvoice({
      clientId: client.id,
      projectId: null,
      status: "sent",
      publicToken: mintPublicToken()
    })
    const otherInvoice = await makeInvoice({
      clientId: other.id,
      projectId: null,
      status: "sent",
      publicToken: mintPublicToken()
    })

    await makeCreditNote({ invoiceId: ownInvoice.id, number: "CN-OWN-1", totalCents: 5000 })
    await makeCreditNote({ invoiceId: otherInvoice.id, number: "CN-OTHER-1", totalCents: 7000 })

    const portal = await getClientPortal({ token })

    expect(portal?.invoices).toHaveLength(1)
    expect(portal?.invoices[0]?.creditNotes).toEqual([
      expect.objectContaining({ number: "CN-OWN-1", totalCents: 5000 })
    ])
  })
})

describe("getClientPortal availability", () => {
  test("answers a revoked portal exactly as it answers an unknown token", async () => {
    const { client, token } = await makePortalClient()

    await database.update(clients).set({ portalToken: null }).where(eq(clients.id, client.id))

    const revoked = await getClientPortal({ token })
    const unknown = await getClientPortal({ token: mintPublicToken() })

    expect(revoked).toBeNull()
    expect(unknown).toBeNull()
    expect(revoked).toEqual(unknown)
  })

  test("answers an archived client exactly as it answers an unknown token", async () => {
    const { client, token } = await makePortalClient()

    await database.update(clients).set({ deletedAt: new Date() }).where(eq(clients.id, client.id))

    const archived = await getClientPortal({ token })
    const unknown = await getClientPortal({ token: mintPublicToken() })

    expect(archived).toBeNull()
    expect(archived).toEqual(unknown)
  })

  test("answers a malformed token with the same empty result", async () => {
    await expect(getClientPortal({ token: "" })).resolves.toBeNull()
    await expect(getClientPortal({ token: "x".repeat(500) })).resolves.toBeNull()
    await expect(getClientPortal({})).resolves.toBeNull()
  })

  test("compares against a decoy when the lookup misses, so a miss costs a hit the same work", async () => {
    await makePortalClient()

    await getClientPortal({ token: mintPublicToken() })

    expect(mocks.matchesPublicToken).toHaveBeenCalledTimes(1)
    expect(mocks.matchesPublicToken.mock.calls[0]?.[1]).toHaveLength(43)
  })
})

describe("getClientPortal population", () => {
  test("withholds a draft invoice and an unissued proposal or contract", async () => {
    const { client, token } = await makePortalClient()

    await makeInvoice({ clientId: client.id, projectId: null, status: "draft" })
    await makeProposal({ clientId: client.id, projectId: null, status: "draft", issuedAt: null })
    await makeContract({ clientId: client.id, status: "draft", issuedAt: null })

    const portal = await getClientPortal({ token })

    expect(portal?.invoices).toEqual([])
    expect(portal?.proposals).toEqual([])
    expect(portal?.contracts).toEqual([])
  })

  test("withholds an archived invoice, proposal, contract and project", async () => {
    const { client, token } = await makePortalClient()
    const archivedAt = new Date("2026-07-10T00:00:00.000Z")

    await makeInvoice({
      clientId: client.id,
      projectId: null,
      status: "sent",
      publicToken: mintPublicToken(),
      deletedAt: archivedAt
    })
    await makeProposal({
      clientId: client.id,
      projectId: null,
      status: "sent",
      issuedAt: new Date("2026-07-01T00:00:00.000Z"),
      deletedAt: archivedAt
    })
    await makeContract({
      clientId: client.id,
      status: "sent",
      issuedAt: new Date("2026-07-01T00:00:00.000Z"),
      deletedAt: archivedAt
    })
    await makeProject({ clientId: client.id, deletedAt: archivedAt })

    const portal = await getClientPortal({ token })

    expect(portal?.invoices).toEqual([])
    expect(portal?.proposals).toEqual([])
    expect(portal?.contracts).toEqual([])
    expect(portal?.projects).toEqual([])
  })

  test("reads the statement in the client's own locale when they have one", async () => {
    const { token } = await makePortalClient({ locale: "de-DE" })

    const portal = await getClientPortal({ token })

    expect(portal?.locale).toBe("de-DE")
    expect(portal?.timeZone).toBe("UTC")
  })

  test("falls back to the instance locale when the client has none", async () => {
    const { token } = await makePortalClient({ locale: null })

    const portal = await getClientPortal({ token })

    expect(portal?.locale).toBe("en")
  })
})

describe("getClientPortal links", () => {
  test("links an invoice and a proposal that their own routes would still admit", async () => {
    const { client, token } = await makePortalClient()
    const invoiceToken = mintPublicToken()
    const proposalToken = mintPublicToken()

    await makeInvoice({
      clientId: client.id,
      projectId: null,
      status: "sent",
      publicToken: invoiceToken
    })
    await makeProposal({
      clientId: client.id,
      projectId: null,
      status: "sent",
      issuedAt: new Date("2026-07-01T00:00:00.000Z"),
      validUntil: new Date("2026-08-01T00:00:00.000Z"),
      publicToken: proposalToken
    })

    const portal = await getClientPortal({ token })

    expect(portal?.invoices[0]?.documentPath).toBe(`/i/${invoiceToken}`)
    expect(portal?.proposals[0]?.documentPath).toBe(`/p/${proposalToken}`)
  })

  test("shows an invoice whose link was withdrawn without offering one", async () => {
    const { client, token } = await makePortalClient()

    await makeInvoice({
      clientId: client.id,
      projectId: null,
      status: "sent",
      number: "INV-REVOKED-1",
      publicToken: null
    })

    const portal = await getClientPortal({ token })

    expect(portal?.invoices[0]).toEqual(
      expect.objectContaining({ number: "INV-REVOKED-1", documentPath: null })
    )
  })

  test("withholds the link to a lapsed proposal its own route would turn away", async () => {
    const { client, token } = await makePortalClient()

    await makeProposal({
      clientId: client.id,
      projectId: null,
      status: "sent",
      issuedAt: new Date("2026-06-01T00:00:00.000Z"),
      validUntil: new Date("2026-07-01T00:00:00.000Z")
    })

    const portal = await getClientPortal({ token })

    expect(portal?.proposals).toHaveLength(1)
    expect(portal?.proposals[0]?.documentPath).toBeNull()
  })

  test("withholds the link to a proposal whose project has been archived", async () => {
    const { client, token } = await makePortalClient()
    const project = await makeProject({ clientId: client.id })

    await makeProposal({
      projectId: project.id,
      clientId: client.id,
      status: "sent",
      issuedAt: new Date("2026-07-01T00:00:00.000Z")
    })

    await database
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(eq(projects.id, project.id))

    const portal = await getClientPortal({ token })

    expect(portal?.proposals[0]?.documentPath).toBeNull()
  })
})

describe("getClientPortal figures", () => {
  test("reports what is still outstanding once per currency", async () => {
    const { client, token } = await makePortalClient()

    await makeInvoice({
      clientId: client.id,
      projectId: null,
      status: "sent",
      currency: "EUR",
      totalCents: 100000,
      amountPaidCents: 25000,
      publicToken: mintPublicToken()
    })
    await makeInvoice({
      clientId: client.id,
      projectId: null,
      status: "sent",
      currency: "USD",
      totalCents: 40000,
      publicToken: mintPublicToken()
    })
    await makeInvoice({
      clientId: client.id,
      projectId: null,
      status: "paid",
      currency: "EUR",
      totalCents: 60000,
      amountPaidCents: 60000,
      paidAt: new Date("2026-07-05T00:00:00.000Z"),
      publicToken: mintPublicToken()
    })

    const portal = await getClientPortal({ token })

    expect(portal?.outstanding).toEqual(
      expect.arrayContaining([
        { currency: "EUR", totalCents: 75000 },
        { currency: "USD", totalCents: 40000 }
      ])
    )
    expect(portal?.outstanding).toHaveLength(2)
  })

  test("takes a credit note off what the invoice still owes, and off the total", async () => {
    const { client, token } = await makePortalClient()

    const invoice = await makeInvoice({
      clientId: client.id,
      projectId: null,
      status: "sent",
      currency: "EUR",
      totalCents: 100000,
      publicToken: mintPublicToken()
    })

    await makeCreditNote({ invoiceId: invoice.id, number: "CN-0002", totalCents: 40000 })

    const portal = await getClientPortal({ token })

    expect(portal?.invoices[0]?.outstandingCents).toBe(60000)
    expect(portal?.outstanding).toEqual([{ currency: "EUR", totalCents: 60000 }])
  })

  test("reports nothing outstanding on an invoice that was credited in full", async () => {
    const { client, token } = await makePortalClient()

    const invoice = await makeInvoice({
      clientId: client.id,
      projectId: null,
      status: "sent",
      currency: "EUR",
      totalCents: 100000,
      publicToken: mintPublicToken()
    })

    await makeCreditNote({ invoiceId: invoice.id, number: "CN-0003", totalCents: 100000 })

    const portal = await getClientPortal({ token })

    expect(portal?.invoices[0]?.outstandingCents).toBe(0)
    expect(portal?.outstanding).toEqual([])
  })

  test("derives an overdue reading from the due date rather than the stored status", async () => {
    const { client, token } = await makePortalClient()

    await makeInvoice({
      clientId: client.id,
      projectId: null,
      status: "sent",
      issueDate: new Date("2026-05-01T00:00:00.000Z"),
      dueDate: new Date("2026-06-01T00:00:00.000Z"),
      totalCents: 100000,
      publicToken: mintPublicToken()
    })

    const portal = await getClientPortal({ token })

    expect(portal?.invoices[0]?.viewStatus).toBe("overdue")
  })

  test("reads a lapsed contract as expired rather than as still sent", async () => {
    const { client, token } = await makePortalClient()

    await makeContract({
      clientId: client.id,
      status: "sent",
      issuedAt: new Date("2026-05-01T00:00:00.000Z"),
      effectiveUntil: new Date("2026-06-01T00:00:00.000Z")
    })

    const portal = await getClientPortal({ token })

    expect(portal?.contracts[0]?.status).toBe("expired")
  })
})
