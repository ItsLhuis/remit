import { and, eq, isNull } from "drizzle-orm"

import Stripe from "stripe"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, invoices, payments, settings } from "@/database/schema"

import { makeInvoice, makeSettings } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn()
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
    info: vi.fn(),
    warn: vi.fn()
  }
}))

// Deliberately not shaped like real Stripe credentials. Both are only ever HMAC key material and an
// unused constructor argument here, and a fixture wearing the `whsec_`/`sk_test_` prefixes reads as a
// committed secret to both a scanner and a human (`security.md`).
const WEBHOOK_SECRET = "stripe-webhook-signing-value-for-integration-tests-not-real"
const SECRET_KEY = "stripe-api-value-for-integration-tests-not-real"

// The event body is signed with the real SDK helper and verified by the real SDK verifier, so the
// signature path under test is the shipped one rather than a stub of it.
function buildEventPayload(input: {
  invoiceId: string
  paymentIntentId: string
  amountCents: number
  currency?: string
  type?: string
}): string {
  return JSON.stringify({
    id: "evt_test",
    object: "event",
    type: input.type ?? "payment_intent.succeeded",
    data: {
      object: {
        id: input.paymentIntentId,
        object: "payment_intent",
        amount_received: input.amountCents,
        currency: input.currency ?? "eur",
        created: 1_780_000_000,
        metadata: { remit_invoice_id: input.invoiceId }
      }
    }
  })
}

function signPayload(payload: string): string {
  return new Stripe(SECRET_KEY).webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET
  })
}

async function readInvoice(invoiceId: string) {
  const row = await database.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) })

  if (!row) throw new Error("readInvoice: invoice missing")

  return row
}

async function listRecordedPayments(invoiceId: string) {
  return database
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), isNull(payments.deletedAt)))
}

describe("stripe webhook receiver", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeSettings({
      stripeSecretKey: SECRET_KEY,
      stripeWebhookSecret: WEBHOOK_SECRET
    })
  })

  test("records a payment for a signed succeeded intent", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })
    const payload = buildEventPayload({
      invoiceId: invoice.id,
      paymentIntentId: "pi_first",
      amountCents: 30000
    })

    const result = await handleStripeWebhook({
      payload,
      signature: signPayload(payload),
      ipAddress: "203.0.113.10",
      userAgent: "Stripe/1.0"
    })

    expect(result).toEqual({
      data: {
        status: "recorded",
        paymentId: expect.any(String),
        invoiceId: invoice.id,
        settled: true
      }
    })

    const updated = await readInvoice(invoice.id)

    expect(Number(updated.amountPaidCents)).toBe(30000)
    expect(updated.status).toBe("paid")
  })

  test("records one payment when the same intent is delivered twice", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })
    const payload = buildEventPayload({
      invoiceId: invoice.id,
      paymentIntentId: "pi_replayed",
      amountCents: 10000
    })
    const signature = signPayload(payload)

    const first = await handleStripeWebhook({
      payload,
      signature,
      ipAddress: null,
      userAgent: null
    })
    const replay = await handleStripeWebhook({
      payload,
      signature,
      ipAddress: null,
      userAgent: null
    })

    expect(first).toMatchObject({ data: { status: "recorded" } })
    expect(replay).toMatchObject({ data: { status: "duplicate" } })

    const recorded = await listRecordedPayments(invoice.id)
    const updated = await readInvoice(invoice.id)

    expect(recorded).toHaveLength(1)
    expect(Number(updated.amountPaidCents)).toBe(10000)
  })

  test("emits payment.received once across a delivery and its replay", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })
    const payload = buildEventPayload({
      invoiceId: invoice.id,
      paymentIntentId: "pi_replayed_events",
      amountCents: 10000
    })
    const signature = signPayload(payload)

    await handleStripeWebhook({ payload, signature, ipAddress: null, userAgent: null })
    await handleStripeWebhook({ payload, signature, ipAddress: null, userAgent: null })

    expect(mocks.emit.mock.calls.filter(([event]) => event === "payment.received")).toHaveLength(1)
  })

  test("writes nothing when the signature does not match the payload", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })
    const payload = buildEventPayload({
      invoiceId: invoice.id,
      paymentIntentId: "pi_forged",
      amountCents: 30000
    })
    const signature = signPayload(
      buildEventPayload({
        invoiceId: invoice.id,
        paymentIntentId: "pi_forged",
        amountCents: 100
      })
    )

    const result = await handleStripeWebhook({
      payload,
      signature,
      ipAddress: "203.0.113.10",
      userAgent: "Forged/1.0"
    })

    expect(result).toEqual({ error: "invalid_signature" })
    expect(await listRecordedPayments(invoice.id)).toHaveLength(0)
    expect(Number((await readInvoice(invoice.id)).amountPaidCents)).toBe(0)
  })

  test("rejects a request that carries no signature header at all", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })
    const payload = buildEventPayload({
      invoiceId: invoice.id,
      paymentIntentId: "pi_unsigned",
      amountCents: 30000
    })

    const result = await handleStripeWebhook({
      payload,
      signature: null,
      ipAddress: null,
      userAgent: null
    })

    expect(result).toEqual({ error: "invalid_signature" })
    expect(await listRecordedPayments(invoice.id)).toHaveLength(0)
  })

  test("audits a rejected signature so a forged delivery leaves a trace", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    await handleStripeWebhook({
      payload: "{}",
      signature: "t=1,v1=deadbeef",
      ipAddress: "203.0.113.99",
      userAgent: "Forged/1.0"
    })

    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "payment.stripe.signature_rejected"))

    expect(entries).toHaveLength(1)
    expect(entries[0]?.ipAddress).toBe("203.0.113.99")
  })

  test("ignores a verified event Remit does not handle", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })
    const payload = buildEventPayload({
      invoiceId: invoice.id,
      paymentIntentId: "pi_other_event",
      amountCents: 30000,
      type: "payment_intent.created"
    })

    const result = await handleStripeWebhook({
      payload,
      signature: signPayload(payload),
      ipAddress: null,
      userAgent: null
    })

    expect(result).toEqual({ data: { status: "ignored", reason: "unhandled_event" } })
    expect(await listRecordedPayments(invoice.id)).toHaveLength(0)
  })

  test("ignores a verified intent that names no Remit invoice", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const payload = JSON.stringify({
      id: "evt_unlinked",
      object: "event",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_unlinked",
          object: "payment_intent",
          amount_received: 10000,
          currency: "eur",
          created: 1_780_000_000,
          metadata: {}
        }
      }
    })

    const result = await handleStripeWebhook({
      payload,
      signature: signPayload(payload),
      ipAddress: null,
      userAgent: null
    })

    expect(result).toEqual({ data: { status: "ignored", reason: "unlinked_intent" } })
  })

  test("refuses an intent denominated in another currency", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })
    const payload = buildEventPayload({
      invoiceId: invoice.id,
      paymentIntentId: "pi_usd",
      amountCents: 30000,
      currency: "usd"
    })

    const result = await handleStripeWebhook({
      payload,
      signature: signPayload(payload),
      ipAddress: null,
      userAgent: null
    })

    expect(result).toEqual({ data: { status: "rejected", reason: "currency_mismatch" } })
    expect(await listRecordedPayments(invoice.id)).toHaveLength(0)
  })

  test("refuses and audits an intent that would overpay the invoice", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })
    const payload = buildEventPayload({
      invoiceId: invoice.id,
      paymentIntentId: "pi_overpaid",
      amountCents: 30001
    })

    const result = await handleStripeWebhook({
      payload,
      signature: signPayload(payload),
      ipAddress: null,
      userAgent: null
    })

    expect(result).toEqual({ data: { status: "rejected", reason: "overpaid" } })
    expect(await listRecordedPayments(invoice.id)).toHaveLength(0)

    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "payment.stripe.rejected"))

    expect(entries).toHaveLength(1)
  })

  test("reports the instance as unconfigured when no webhook secret is stored", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    await database.update(settings).set({ stripeWebhookSecret: null })

    const result = await handleStripeWebhook({
      payload: "{}",
      signature: "t=1,v1=deadbeef",
      ipAddress: null,
      userAgent: null
    })

    expect(result).toEqual({ error: "not_configured" })
  })

  test("keeps no secret material in the audit trail", async () => {
    const { handleStripeWebhook } = await import("../stripeWebhook")

    const invoice = await makeInvoice({ status: "sent", totalCents: 30000, currency: "EUR" })
    const payload = buildEventPayload({
      invoiceId: invoice.id,
      paymentIntentId: "pi_audit",
      amountCents: 30000
    })

    await handleStripeWebhook({
      payload,
      signature: signPayload(payload),
      ipAddress: null,
      userAgent: null
    })

    const entries = await database.select().from(auditLogs)
    const serialized = JSON.stringify(entries)

    expect(serialized).not.toContain(WEBHOOK_SECRET)
    expect(serialized).not.toContain(SECRET_KEY)
  })
})
