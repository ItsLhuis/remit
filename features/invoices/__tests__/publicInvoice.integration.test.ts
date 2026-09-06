import { eq } from "drizzle-orm"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { mintPublicToken } from "@/lib/publicToken"

import { invoices, projects, settings } from "@/database/schema"

import { makeClient, makeInvoice, makeLineItem, makeProject, makeSettings } from "@/tests/factories"
import { database } from "@/tests/integration/database"

import { getPublicInvoice } from "../publicQueries"
import { recordPublicInvoiceView } from "../publicView"

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

function makeToken() {
  return mintPublicToken()
}

async function makeSentInvoice(overrides?: Record<string, unknown>) {
  const client = await makeClient({ name: "Northwind Ltd", email: "ops@northwind.test" })
  const project = await makeProject({ clientId: client.id, name: "Website rebuild" })

  const invoice = await makeInvoice({
    projectId: project.id,
    clientId: client.id,
    status: "sent",
    publicToken: makeToken(),
    issueDate: new Date("2026-07-01T00:00:00.000Z"),
    dueDate: new Date("2026-07-31T00:00:00.000Z"),
    subtotalCents: 100000,
    taxAmountCents: 23400,
    totalCents: 123400,
    notes: "Payable within 30 days.",
    ...overrides
  })

  await makeLineItem({ invoiceId: invoice.id, proposalId: null, description: "Discovery workshop" })

  return { client, project, invoice }
}

async function setPaymentSettings(values: Partial<typeof settings.$inferInsert>) {
  await database.update(settings).set(values)
}

async function readInvoice(id: string) {
  const row = await database.query.invoices.findFirst({ where: eq(invoices.id, id) })

  if (!row) throw new Error("readInvoice: invoice not found")

  return row
}

// Only `Date` is faked: the Postgres client schedules real timers, and replacing those deadlocks
// the connection. `deriveInvoiceStatusView` reads `new Date()`, so the fixed instant is what makes
// the overdue and partially-paid cases below deterministic — it sits between the fixture's issue
// date and its due date, so the base invoice is neither.
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

describe("getPublicInvoice", () => {
  test("renders a sent invoice for the holder of its token", async () => {
    const { invoice } = await makeSentInvoice()

    const result = await getPublicInvoice({ token: invoice.publicToken })

    expect(result).toEqual(
      expect.objectContaining({
        number: invoice.number,
        status: "sent",
        totalCents: 123400,
        outstandingCents: 123400,
        preparedFor: "Website rebuild",
        notes: "Payable within 30 days."
      })
    )
    expect(result?.lineItems).toHaveLength(1)
  })

  test("never exposes the token or the invoice id in the read model", async () => {
    const { invoice } = await makeSentInvoice()

    const result = await getPublicInvoice({ token: invoice.publicToken })

    expect(JSON.stringify(result)).not.toContain(invoice.publicToken)
    expect(JSON.stringify(result)).not.toContain(invoice.id)
  })

  test("returns the same empty result for an unknown token as for an archived invoice", async () => {
    const { invoice } = await makeSentInvoice()

    await database
      .update(invoices)
      .set({ deletedAt: new Date() })
      .where(eq(invoices.id, invoice.id))

    const archived = await getPublicInvoice({ token: invoice.publicToken })
    const unknown = await getPublicInvoice({ token: makeToken() })

    expect(archived).toBeNull()
    expect(unknown).toBeNull()
    expect(archived).toEqual(unknown)
  })

  test("returns the same empty result for a malformed token", async () => {
    await expect(getPublicInvoice({ token: "" })).resolves.toBeNull()
    await expect(getPublicInvoice({ token: "x".repeat(500) })).resolves.toBeNull()
    await expect(getPublicInvoice({})).resolves.toBeNull()
  })

  test("withholds a draft even when it already carries an issue date", async () => {
    const { invoice } = await makeSentInvoice({ status: "draft" })

    await expect(getPublicInvoice({ token: invoice.publicToken })).resolves.toBeNull()
  })

  test("stays payable when the project it was raised from has been archived", async () => {
    const { project, invoice } = await makeSentInvoice()

    await database
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(eq(projects.id, project.id))

    const result = await getPublicInvoice({ token: invoice.publicToken })

    expect(result?.number).toBe(invoice.number)
    expect(result?.preparedFor).toBe("Northwind Ltd")
  })

  test("derives an overdue badge from the due date rather than the stored status", async () => {
    const { invoice } = await makeSentInvoice({
      issueDate: new Date("2019-12-01T00:00:00.000Z"),
      dueDate: new Date("2020-01-01T00:00:00.000Z")
    })

    const result = await getPublicInvoice({ token: invoice.publicToken })

    expect(result?.status).toBe("sent")
    expect(result?.viewStatus).toBe("overdue")
  })

  test("reports what is still outstanding after a partial payment", async () => {
    const { invoice } = await makeSentInvoice({ amountPaidCents: 23400 })

    const result = await getPublicInvoice({ token: invoice.publicToken })

    expect(result?.outstandingCents).toBe(100000)
    expect(result?.viewStatus).toBe("partially_paid")
  })

  test("compares against a decoy when the lookup misses, so a miss costs a hit the same work", async () => {
    await makeSentInvoice()

    await getPublicInvoice({ token: makeToken() })

    expect(mocks.matchesPublicToken).toHaveBeenCalledTimes(1)
    expect(mocks.matchesPublicToken.mock.calls[0]?.[1]).toHaveLength(43)
  })
})

describe("getPublicInvoice payment affordances", () => {
  test("publishes bank transfer details without the full IBAN", async () => {
    await setPaymentSettings({
      paymentBankName: "Acme Bank",
      paymentIban: "GB82WEST12345698765432",
      paymentInstructions: "Quote the invoice number."
    })
    const { invoice } = await makeSentInvoice()

    const result = await getPublicInvoice({ token: invoice.publicToken })

    expect(result?.payment).toEqual({
      bankName: "Acme Bank",
      ibanDisplay: "GB82 ... 5432",
      instructions: "Quote the invoice number.",
      hasBankTransferDetails: true,
      stripeConfigured: false
    })
    expect(JSON.stringify(result)).not.toContain("GB82WEST12345698765432")
  })

  test("announces card payment as a boolean and never as a key", async () => {
    await setPaymentSettings({
      stripeSecretKey: "sk_test_never_public",
      stripeWebhookSecret: "whsec_never_public"
    })
    const { invoice } = await makeSentInvoice()

    const result = await getPublicInvoice({ token: invoice.publicToken })

    expect(result?.payment.stripeConfigured).toBe(true)
    expect(result?.payment.hasBankTransferDetails).toBe(false)
    expect(JSON.stringify(result)).not.toContain("sk_test_never_public")
    expect(JSON.stringify(result)).not.toContain("whsec_never_public")
  })

  // The configuration that would take a client's money and record nothing: a Checkout Session needs
  // only the secret key, and the webhook secret is what verifies the event that settles the invoice.
  // The pay affordance is gated on both, so this state offers no card payment at all.
  test("offers no card payment when a secret key is stored without a webhook secret", async () => {
    await setPaymentSettings({
      stripeSecretKey: "sk_test_never_public",
      stripeWebhookSecret: null
    })
    const { invoice } = await makeSentInvoice()

    const result = await getPublicInvoice({ token: invoice.publicToken })

    expect(result?.payment.stripeConfigured).toBe(false)
  })

  test("offers both methods when both are configured", async () => {
    await setPaymentSettings({
      paymentBankName: "Acme Bank",
      stripeSecretKey: "sk_test_never_public",
      stripeWebhookSecret: "whsec_never_public"
    })
    const { invoice } = await makeSentInvoice()

    const result = await getPublicInvoice({ token: invoice.publicToken })

    expect(result?.payment.hasBankTransferDetails).toBe(true)
    expect(result?.payment.stripeConfigured).toBe(true)
  })

  test("offers neither method when the instance has published no payment details", async () => {
    const { invoice } = await makeSentInvoice()

    const result = await getPublicInvoice({ token: invoice.publicToken })

    expect(result?.payment).toEqual({
      bankName: null,
      ibanDisplay: null,
      instructions: null,
      hasBankTransferDetails: false,
      stripeConfigured: false
    })
  })
})

describe("recordPublicInvoiceView", () => {
  test("stamps the first and last view and counts it", async () => {
    const { invoice } = await makeSentInvoice()

    await recordPublicInvoiceView({ token: invoice.publicToken })

    const row = await readInvoice(invoice.id)

    expect(row.viewCount).toBe(1)
    expect(row.firstViewedAt).not.toBeNull()
    expect(row.lastViewedAt).not.toBeNull()
  })

  test("keeps the first view fixed while moving the last view forward", async () => {
    const { invoice } = await makeSentInvoice()

    await recordPublicInvoiceView({ token: invoice.publicToken })
    const first = await readInvoice(invoice.id)

    await recordPublicInvoiceView({ token: invoice.publicToken })
    const second = await readInvoice(invoice.id)

    expect(second.viewCount).toBe(2)
    expect(second.firstViewedAt?.getTime()).toBe(first.firstViewedAt?.getTime())
    expect(second.lastViewedAt?.getTime()).toBeGreaterThanOrEqual(
      first.lastViewedAt?.getTime() ?? 0
    )
  })

  test("counts nothing for a draft, an archived invoice, or an unknown token", async () => {
    const { invoice: draft } = await makeSentInvoice({ status: "draft" })
    const { invoice: archived } = await makeSentInvoice({ deletedAt: new Date() })

    await recordPublicInvoiceView({ token: draft.publicToken })
    await recordPublicInvoiceView({ token: archived.publicToken })
    await recordPublicInvoiceView({ token: makeToken() })

    expect((await readInvoice(draft.id)).viewCount).toBe(0)
    expect((await readInvoice(archived.id)).viewCount).toBe(0)
  })

  test("ignores a malformed token without touching a row", async () => {
    const { invoice } = await makeSentInvoice()

    await recordPublicInvoiceView({ token: "" })

    expect((await readInvoice(invoice.id)).viewCount).toBe(0)
  })
})
