import { createServer, type IncomingHttpHeaders, type Server, type ServerResponse } from "node:http"
import { type AddressInfo } from "node:net"

import { eq } from "drizzle-orm"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, webhookDeliveries, webhookEndpoints } from "@/database/schema"

import { makeWebhookDelivery, makeWebhookEndpoint } from "@/tests/factories"
import { database } from "@/tests/integration/database"

import { sendWebhookDelivery, WebhookRetryError } from "../delivery"
import { WEBHOOK_DISABLE_AFTER_FAILURES, WEBHOOK_MAX_ATTEMPTS } from "../services/deliveryPolicy"
import { verifyWebhookSignature } from "../services/signature"

// `127.0.0.1` is allowlisted so the local receiver below is reachable over plain HTTP, the way an
// operator would allow an automation server on their own network. `localhost` deliberately is not:
// the exact-hostname allowlist is what makes the name case below a real refusal.
vi.mock("@/lib/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config/env")>()

  return { ...actual, env: { ...actual.env, REMIT_WEBHOOK_ALLOWED_HOSTS: ["127.0.0.1"] } }
})

type ReceivedRequest = {
  headers: IncomingHttpHeaders
  body: string
}

let server: Server
let received: ReceivedRequest[]
let respond: (response: ServerResponse) => void
let receiverUrl: string

beforeEach(async () => {
  received = []
  respond = (response) => {
    response.statusCode = 204
    response.end()
  }

  server = createServer((request, response) => {
    let body = ""

    request.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8")
    })
    request.on("end", () => {
      received.push({ headers: request.headers, body })
      respond(response)
    })
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))

  receiverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`
})

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

async function readDelivery(id: string) {
  const [row] = await database.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id))

  return row
}

function firstOutcome(attempts: unknown): unknown {
  return Array.isArray(attempts) ? (attempts[0] as { outcome?: unknown }).outcome : undefined
}

describe("webhook delivery", () => {
  test("delivers a payload the receiver can verify with the endpoint's secret", async () => {
    const endpoint = await makeWebhookEndpoint({ url: receiverUrl })
    const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

    const decision = await sendWebhookDelivery(delivery.id)

    const [request] = received

    expect(decision).toBe("succeeded")
    expect(request?.headers["webhook-id"]).toBe(delivery.id)
    expect(
      verifyWebhookSignature({
        messageId: String(request?.headers["webhook-id"]),
        timestampSeconds: Number(request?.headers["webhook-timestamp"]),
        body: request?.body ?? "",
        secret: endpoint.secret,
        signatureHeader: String(request?.headers["webhook-signature"]),
        nowSeconds: Math.floor(Date.now() / 1000)
      })
    ).toBe(true)
    expect((await readDelivery(delivery.id))?.status).toBe("succeeded")
  })

  test("retries a failing receiver, stops at the bound, and records every attempt", async () => {
    respond = (response) => {
      response.statusCode = 503
      response.end()
    }

    const endpoint = await makeWebhookEndpoint({ url: receiverUrl })
    const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

    for (let attempt = 1; attempt < WEBHOOK_MAX_ATTEMPTS; attempt++) {
      await expect(sendWebhookDelivery(delivery.id)).rejects.toBeInstanceOf(WebhookRetryError)
    }

    const finalDecision = await sendWebhookDelivery(delivery.id)
    const row = await readDelivery(delivery.id)

    expect(finalDecision).toBe("failed")
    expect(received).toHaveLength(WEBHOOK_MAX_ATTEMPTS)
    expect(row?.attemptCount).toBe(WEBHOOK_MAX_ATTEMPTS)
    expect(row?.attempts).toHaveLength(WEBHOOK_MAX_ATTEMPTS)
    expect(row?.lastStatusCode).toBe(503)
  })

  test("never follows a redirect, even to a private address", async () => {
    respond = (response) => {
      response.statusCode = 302
      response.setHeader("location", "http://10.0.0.1/admin")
      response.end()
    }

    const endpoint = await makeWebhookEndpoint({ url: receiverUrl })
    const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

    const decision = await sendWebhookDelivery(delivery.id)

    expect(decision).toBe("failed")
    expect(received).toHaveLength(1)
    expect(firstOutcome((await readDelivery(delivery.id))?.attempts)).toBe("redirect")
  })

  test("refuses loopback reached through a hostname the operator did not allowlist", async () => {
    const port = (server.address() as AddressInfo).port
    const endpoint = await makeWebhookEndpoint({ url: `https://localhost:${port}/hook` })
    const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

    const decision = await sendWebhookDelivery(delivery.id)

    expect(decision).toBe("failed")
    expect(received).toHaveLength(0)
    expect(firstOutcome((await readDelivery(delivery.id))?.attempts)).toBe("blocked")
  })

  test("refuses a private-range address literal without opening a connection", async () => {
    const endpoint = await makeWebhookEndpoint({ url: "https://10.0.0.5/hook" })
    const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

    const decision = await sendWebhookDelivery(delivery.id)

    expect(decision).toBe("failed")
    expect(firstOutcome((await readDelivery(delivery.id))?.attempts)).toBe("blocked")
  })

  test("refuses a public-looking name that resolves to a private address", async () => {
    const endpoint = await makeWebhookEndpoint({ url: "https://hooks.example.test/hook" })
    const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

    const decision = await sendWebhookDelivery(delivery.id, {
      resolve: async () => [{ address: "192.168.1.50", family: 4 }]
    })

    expect(decision).toBe("failed")
    expect(firstOutcome((await readDelivery(delivery.id))?.attempts)).toBe("blocked")
  })

  test("refuses a name whose records mix a public address with a private one", async () => {
    const endpoint = await makeWebhookEndpoint({ url: "https://hooks.example.test/hook" })
    const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

    await sendWebhookDelivery(delivery.id, {
      resolve: async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.1", family: 4 }
      ]
    })

    expect(firstOutcome((await readDelivery(delivery.id))?.attempts)).toBe("blocked")
  })

  test("switches an endpoint off and audits it once its failure streak reaches the threshold", async () => {
    const endpoint = await makeWebhookEndpoint({
      url: "https://10.0.0.5/hook",
      consecutiveFailures: WEBHOOK_DISABLE_AFTER_FAILURES - 1
    })
    const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

    await sendWebhookDelivery(delivery.id)

    const [row] = await database
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, endpoint.id))
    const audits = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "webhook.endpoint.auto_disabled"))

    expect(row?.active).toBe(false)
    expect(row?.disabledReason).toBe("consecutive_failures")
    expect(audits).toHaveLength(1)
  })

  test("sends nothing for a delivery that already finished when its job is re-delivered", async () => {
    const endpoint = await makeWebhookEndpoint({ url: receiverUrl })
    const delivery = await makeWebhookDelivery({ endpointId: endpoint.id, status: "succeeded" })

    const decision = await sendWebhookDelivery(delivery.id)

    expect(decision).toBeNull()
    expect(received).toHaveLength(0)
  })

  test("records a failure without a request when the endpoint was disabled after queueing", async () => {
    const endpoint = await makeWebhookEndpoint({
      url: receiverUrl,
      active: false,
      disabledReason: "manual"
    })
    const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

    const decision = await sendWebhookDelivery(delivery.id)

    expect(decision).toBe("failed")
    expect(received).toHaveLength(0)
    expect(firstOutcome((await readDelivery(delivery.id))?.attempts)).toBe("endpoint_inactive")
  })
})
