import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, invoices } from "@/database/schema"

import {
  makeClient,
  makeInvoice,
  makeLineItem,
  makeProject,
  makeSettings,
  makeUser,
  publicTokenOf
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  enqueueJob: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  matchesPublicToken: vi.fn(),
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

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/lib/jobs", () => ({
  enqueueJob: mocks.enqueueJob
}))

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, fatal: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

vi.mock("@/lib/publicToken", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/publicToken")>()

  return {
    ...actual,
    matchesPublicToken: mocks.matchesPublicToken.mockImplementation(actual.matchesPublicToken)
  }
})

const ownerId = "00000000-0000-4000-8000-0000000004a1"

async function makeSentInvoice(overrides?: Record<string, unknown>) {
  const client = await makeClient({ name: "Northwind Ltd", email: "ops@northwind.test" })
  const project = await makeProject({ clientId: client.id })

  const invoice = await makeInvoice({
    projectId: project.id,
    clientId: client.id,
    status: "sent",
    issueDate: new Date("2026-07-01T00:00:00.000Z"),
    dueDate: new Date("2026-07-31T00:00:00.000Z"),
    totalCents: 123400,
    ...overrides
  })

  await makeLineItem({ invoiceId: invoice.id, proposalId: null, description: "Discovery workshop" })

  return invoice
}

async function readToken(invoiceId: string) {
  const row = await database.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) })

  return row?.publicToken ?? null
}

describe("invoice public link lifecycle", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: "owner-invoice-link@example.com" })
    await makeSettings({
      businessName: "Studio Remit",
      defaultLocale: "en",
      defaultTimezone: "UTC"
    })

    mocks.headers.mockResolvedValue(
      new Headers({ "user-agent": "Vitest", "x-forwarded-for": "203.0.113.50" })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("stops resolving the old link and resolves the new one after a rotation", async () => {
    const { rotateInvoicePublicLink } = await import("../publicLink")
    const { getPublicInvoice } = await import("../publicQueries")

    const invoice = await makeSentInvoice()
    const originalToken = publicTokenOf(invoice)

    await rotateInvoicePublicLink({ id: invoice.id })

    const rotatedToken = await readToken(invoice.id)

    expect(rotatedToken).not.toBe(originalToken)
    expect(await getPublicInvoice({ token: originalToken })).toBeNull()
    expect(await getPublicInvoice({ token: rotatedToken })).not.toBeNull()
  })

  test("answers a revoked, a rotated-away and an unknown token identically", async () => {
    const { revokeInvoicePublicLink, rotateInvoicePublicLink } = await import("../publicLink")
    const { getPublicInvoice } = await import("../publicQueries")

    const rotated = await makeSentInvoice()
    const rotatedAwayToken = publicTokenOf(rotated)

    await rotateInvoicePublicLink({ id: rotated.id })

    const revoked = await makeSentInvoice()
    const revokedToken = publicTokenOf(revoked)

    await revokeInvoicePublicLink({ id: revoked.id })

    const unknownToken = "0".repeat(43).replace("0", "1")

    mocks.matchesPublicToken.mockClear()

    const results = await Promise.all([
      getPublicInvoice({ token: rotatedAwayToken }),
      getPublicInvoice({ token: revokedToken }),
      getPublicInvoice({ token: unknownToken })
    ])

    expect(results).toEqual([null, null, null])
    // Each miss still spends one constant-time compare against a full-length decoy, so no branch
    // above tells a revoked document apart from a token that never existed.
    expect(mocks.matchesPublicToken).toHaveBeenCalledTimes(3)

    for (const call of mocks.matchesPublicToken.mock.calls) expect(call[1]).toHaveLength(43)
  })

  test("keeps a revoked invoice unreachable and its token cleared", async () => {
    const { revokeInvoicePublicLink } = await import("../publicLink")

    const invoice = await makeSentInvoice()

    await revokeInvoicePublicLink({ id: invoice.id })

    expect(await readToken(invoice.id)).toBeNull()
  })

  test("refuses to manage the link of an invoice that was never sent", async () => {
    const { revokeInvoicePublicLink, rotateInvoicePublicLink } = await import("../publicLink")

    const invoice = await makeInvoice({ status: "draft" })
    const draftToken = publicTokenOf(invoice)

    const rotateResult = await rotateInvoicePublicLink({ id: invoice.id })
    const revokeResult = await revokeInvoicePublicLink({ id: invoice.id })

    expect("error" in rotateResult).toBe(true)
    expect("error" in revokeResult).toBe(true)
    expect(await readToken(invoice.id)).toBe(draftToken)
  })

  test("refuses a role below owner and leaves the token in place", async () => {
    const { rotateInvoicePublicLink } = await import("../publicLink")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const invoice = await makeSentInvoice()

    const result = await rotateInvoicePublicLink({ id: invoice.id })

    expect("error" in result).toBe(true)
    expect(await readToken(invoice.id)).toBe(publicTokenOf(invoice))
  })

  test("audits both actions without recording any token material", async () => {
    const { revokeInvoicePublicLink, rotateInvoicePublicLink } = await import("../publicLink")

    const invoice = await makeSentInvoice()
    const originalToken = publicTokenOf(invoice)

    await rotateInvoicePublicLink({ id: invoice.id })

    const rotatedToken = await readToken(invoice.id)

    await revokeInvoicePublicLink({ id: invoice.id })

    const rows = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetEntityId, invoice.id))

    const events = rows.map((row) => row.event)

    expect(events).toContain("invoice.public_link.rotated")
    expect(events).toContain("invoice.public_link.revoked")

    const serialized = JSON.stringify(rows)

    expect(serialized).not.toContain(originalToken)
    expect(serialized).not.toContain(rotatedToken)
  })
})
