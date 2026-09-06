import { eq } from "drizzle-orm"

import Stripe from "stripe"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, invoices, payments, settings } from "@/database/schema"

import { makeInvoice, makeSettings } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  emit: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  revalidatePath: vi.fn()
}))

// Only the outbound Checkout Session call is stubbed. `webhooks` is the real SDK object, because the
// join this file exists to prove runs a producer-built payload through the shipped verifier, and a
// stubbed verifier would prove nothing about it.
vi.mock("stripe", async () => {
  const actual = await vi.importActual<{ default: typeof Stripe }>("stripe")

  class StripeTestDouble {
    readonly webhooks: Stripe["webhooks"]
    readonly checkout = { sessions: { create: mocks.createSession } }

    constructor(apiKey: string, config?: ConstructorParameters<typeof Stripe>[1]) {
      this.webhooks = new actual.default(apiKey, config).webhooks
    }
  }

  return { ...actual, default: StripeTestDouble }
})

vi.mock("@/lib/i18n/server", () => ({
  t: (key: string) => key
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: mocks.loggerInfo,
    warn: vi.fn()
  }
}))

// Deliberately not shaped like real Stripe credentials, matching the webhook suite beside this one:
// a fixture wearing the `whsec_`/`sk_test_` prefixes reads as a committed secret to both a scanner
// and a human (`security.md`).
const WEBHOOK_SECRET = "stripe-webhook-signing-value-for-integration-tests-not-real"
const SECRET_KEY = "stripe-api-value-for-integration-tests-not-real"

const CHECKOUT_URL = "https://checkout.stripe.test/c/pay/cs_test_integration"

type CreateSessionCall = [Stripe.Checkout.SessionCreateParams, { idempotencyKey: string }]

function lastCreateSessionCall(): CreateSessionCall {
  const call = mocks.createSession.mock.calls.at(-1)

  if (!call) throw new Error("lastCreateSessionCall: no session was created")

  return call as CreateSessionCall
}

// The payment intent Stripe would deliver for the session the producer just asked for: the same
// metadata, the same amount, the same currency. Nothing here is invented by the test.
function buildSucceededEventFor(params: Stripe.Checkout.SessionCreateParams): string {
  const lineItem = params.line_items?.[0]?.price_data

  return JSON.stringify({
    id: "evt_checkout_join",
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_from_checkout_session",
        object: "payment_intent",
        amount_received: lineItem?.unit_amount,
        currency: lineItem?.currency,
        created: 1_780_000_000,
        metadata: params.payment_intent_data?.metadata
      }
    }
  })
}

// `makeSettings` inserts, and Remit holds exactly one settings row, so a second call inside a test
// would leave `findFirst` choosing between two. Clearing first keeps the row singular.
async function setStripeSettings(overrides: {
  stripeSecretKey: string | null
  stripeWebhookSecret: string | null
}) {
  await database.delete(settings)

  await makeSettings(overrides)
}

// `invoices.public_token` is nullable since revocation started clearing it, and the factory mints
// one on every row, so the narrowing here is a type concern rather than a case under test.
function publicTokenOf(invoice: { publicToken: string | null }): string {
  if (!invoice.publicToken) throw new Error("publicTokenOf: the factory minted no token")

  return invoice.publicToken
}

function signPayload(payload: string): string {
  return new Stripe(SECRET_KEY).webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET
  })
}

beforeEach(async () => {
  vi.clearAllMocks()

  mocks.createSession.mockResolvedValue({ id: "cs_test_integration", url: CHECKOUT_URL })

  await setStripeSettings({ stripeSecretKey: SECRET_KEY, stripeWebhookSecret: WEBHOOK_SECRET })
})

describe("public invoice checkout", () => {
  test("stamps the invoice id where the shipped webhook reads it, and the payment lands", async () => {
    const { startPublicInvoiceCheckout } = await import("@/features/invoices/server")
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    const started = await startPublicInvoiceCheckout({
      token: publicTokenOf(invoice),
      ipAddress: "203.0.113.10",
      userAgent: "Mozilla/5.0"
    })

    expect(started).toEqual({ data: { url: CHECKOUT_URL } })

    const [params] = lastCreateSessionCall()

    expect(params.payment_intent_data?.metadata).toEqual({ remit_invoice_id: invoice.id })

    const payload = buildSucceededEventFor(params)
    const settled = await handleStripeWebhook({
      payload,
      signature: signPayload(payload),
      ipAddress: null,
      userAgent: null
    })

    expect(settled).toEqual({
      data: {
        status: "recorded",
        paymentId: expect.any(String),
        invoiceId: invoice.id,
        settled: true
      }
    })

    const [recorded] = await database
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoice.id))

    expect(recorded).toMatchObject({ method: "stripe", currency: "EUR" })
    expect(Number(recorded?.amountCents)).toBe(30000)

    const updated = await database.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) })

    expect(updated?.status).toBe("paid")
  })

  test("charges the amount the invoice says is outstanding, never one supplied by a caller", async () => {
    const { startPublicInvoiceCheckout } = await import("@/features/invoices/server")

    const invoice = await makeInvoice({
      status: "sent",
      totalCents: 30000,
      amountPaidCents: 12500,
      currency: "EUR"
    })

    // The request carries no amount at all — there is no field to supply one — so the only number
    // that can reach Stripe is the one derived from the invoice's own columns.
    await startPublicInvoiceCheckout({
      token: publicTokenOf(invoice),
      ipAddress: null,
      userAgent: null
    })

    const [params] = lastCreateSessionCall()

    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(17500)
    expect(params.line_items?.[0]?.price_data?.currency).toBe("eur")
  })

  test("reuses one idempotency key for repeated submissions on the same balance", async () => {
    const { startPublicInvoiceCheckout } = await import("@/features/invoices/server")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    await startPublicInvoiceCheckout({
      token: publicTokenOf(invoice),
      ipAddress: null,
      userAgent: null
    })

    const [, firstOptions] = lastCreateSessionCall()

    await startPublicInvoiceCheckout({
      token: publicTokenOf(invoice),
      ipAddress: null,
      userAgent: null
    })

    const [, secondOptions] = lastCreateSessionCall()

    expect(secondOptions.idempotencyKey).toBe(firstOptions.idempotencyKey)
  })

  test("returns the client to the invoice on cancel and to the confirmation page on success", async () => {
    const { startPublicInvoiceCheckout } = await import("@/features/invoices/server")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    await startPublicInvoiceCheckout({
      token: publicTokenOf(invoice),
      ipAddress: null,
      userAgent: null
    })

    const [params] = lastCreateSessionCall()

    expect(params.success_url).toContain(`/i/${publicTokenOf(invoice)}/paid`)
    expect(params.cancel_url).toContain(`/i/${publicTokenOf(invoice)}`)
  })

  test("audits a started checkout without recording any key material", async () => {
    const { startPublicInvoiceCheckout } = await import("@/features/invoices/server")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })

    await startPublicInvoiceCheckout({
      token: publicTokenOf(invoice),
      ipAddress: "203.0.113.10",
      userAgent: "Mozilla/5.0"
    })

    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "payment.stripe.checkout_started"))
    const serialised = JSON.stringify(entries)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ targetEntityType: "invoice", targetEntityId: invoice.id })
    expect(serialised).not.toContain(SECRET_KEY)
    expect(serialised).not.toContain(WEBHOOK_SECRET)
    expect(serialised).not.toContain(publicTokenOf(invoice))
  })
})

describe("public invoice checkout refusals", () => {
  // Every refusal answers with the same message an unknown token answers with, so a caller cannot
  // tell any of these five states apart from each other or from a token that never existed.
  async function expectIndistinguishableRefusal(token: string) {
    const { startPublicInvoiceCheckout } = await import("@/features/invoices/server")

    const result = await startPublicInvoiceCheckout({ token, ipAddress: null, userAgent: null })

    expect(result).toEqual({ error: "invoices.public.payment.unavailable" })
    expect(mocks.createSession).not.toHaveBeenCalled()
  }

  test("refuses an unknown token", async () => {
    await expectIndistinguishableRefusal("Z".repeat(43))
  })

  test("refuses a draft invoice", async () => {
    const invoice = await makeInvoice({ status: "draft", totalCents: 30000 })

    await expectIndistinguishableRefusal(publicTokenOf(invoice))
  })

  test("refuses a soft-deleted invoice", async () => {
    const invoice = await makeInvoice({
      status: "sent",
      totalCents: 30000,
      deletedAt: new Date()
    })

    await expectIndistinguishableRefusal(publicTokenOf(invoice))
  })

  test("refuses an invoice that is already settled", async () => {
    const invoice = await makeInvoice({
      status: "paid",
      totalCents: 30000,
      amountPaidCents: 30000
    })

    await expectIndistinguishableRefusal(publicTokenOf(invoice))
  })

  test("refuses an invoice with nothing outstanding", async () => {
    const invoice = await makeInvoice({ status: "sent", totalCents: 0 })

    await expectIndistinguishableRefusal(publicTokenOf(invoice))
  })

  test("refuses when a secret key is stored without a webhook secret", async () => {
    await setStripeSettings({ stripeSecretKey: SECRET_KEY, stripeWebhookSecret: null })

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000 })

    await expectIndistinguishableRefusal(publicTokenOf(invoice))
  })

  test("refuses when Stripe is not configured at all", async () => {
    await setStripeSettings({ stripeSecretKey: null, stripeWebhookSecret: null })

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000 })

    await expectIndistinguishableRefusal(publicTokenOf(invoice))
  })

  test("returns a start failure without a provider message when Stripe rejects the call", async () => {
    const { startPublicInvoiceCheckout } = await import("@/features/invoices/server")

    mocks.createSession.mockRejectedValue(
      new Error("No such customer: 'cus_x'; a similar object exists in test mode")
    )

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000 })

    const result = await startPublicInvoiceCheckout({
      token: publicTokenOf(invoice),
      ipAddress: null,
      userAgent: null
    })

    expect(result).toEqual({ error: "invoices.public.payment.startFailed" })
  })
})
