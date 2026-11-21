import { createServer, type Server, type ServerResponse } from "node:http"
import { type AddressInfo } from "node:net"

import { eq } from "drizzle-orm"

import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"

import { enqueueJob } from "@/lib/jobs"
import { getQueue } from "@/lib/jobs/queue"
import { startWorker, stopWorker } from "@/lib/jobs/worker"

import { webhookDeliveries, webhookEndpoints } from "@/database/schema"

import { loadWorkerFeatureModules } from "@/scripts/core/worker/loadWorkerFeatureModules"
import { makeWebhookDelivery, makeWebhookEndpoint } from "@/tests/factories"
import { database } from "@/tests/integration/database"

// `127.0.0.1` allowlisted for the local receiver, as in `delivery.integration.test.ts`.
vi.mock("@/lib/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config/env")>()

  return { ...actual, env: { ...actual.env, REMIT_WEBHOOK_ALLOWED_HOSTS: ["127.0.0.1"] } }
})

const POLL_INTERVAL_MS = 100
const POLL_TIMEOUT_MS = 20_000

// Fewer attempts than the delivery policy's six, and milliseconds apart rather than minutes, so a
// whole retry schedule fits in a test. Fewer is also the case that matters: BullMQ runs out of
// attempts while the delivery has recorded too few to decide `failed` itself, which is exactly the
// delivery the exhausted handler exists to settle.
const QUEUE_ATTEMPTS = 3

let server: Server
let receiverUrl: string
let respond: (response: ServerResponse, requestNumber: number) => void
let requestCount: number

async function readDelivery(id: string) {
  const [row] = await database.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id))

  return row
}

// Real timers: the queue's backoff arithmetic reads the clock.
async function waitForSettled(id: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  for (;;) {
    const row = await readDelivery(id)

    if (row && row.status !== "pending") return row

    if (Date.now() > deadline) throw new Error("Timed out waiting for the delivery to settle")

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

async function enqueueDelivery(deliveryId: string): Promise<void> {
  await enqueueJob(
    "webhook.delivery.send",
    { deliveryId },
    { jobId: `webhook-delivery-${deliveryId}`, attempts: QUEUE_ATTEMPTS, backoffDelayMs: 10 }
  )
}

// Loaded while the file is collected, for the reason `queueRoundTrip.integration.test.ts` gives.
await loadWorkerFeatureModules()

beforeAll(async () => {
  server = createServer((request, response) => {
    request.resume()
    request.on("end", () => {
      requestCount += 1
      respond(response, requestCount)
    })
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))

  receiverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`

  await getQueue().obliterate({ force: true })

  await startWorker()
})

afterAll(async () => {
  await stopWorker()

  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
  requestCount = 0
})

test("a delivery to an endpoint that always fails ends failed once its job runs out of attempts", async () => {
  respond = (response) => {
    response.statusCode = 503
    response.end()
  }
  const endpoint = await makeWebhookEndpoint({ url: receiverUrl })
  const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

  await enqueueDelivery(delivery.id)

  const settled = await waitForSettled(delivery.id)
  const [endpointRow] = await database
    .select({ consecutiveFailures: webhookEndpoints.consecutiveFailures })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, endpoint.id))

  expect(settled.status).toBe("failed")
  expect(settled.attemptCount).toBe(QUEUE_ATTEMPTS)
  expect(settled.lastStatusCode).toBe(503)
  expect(settled.completedAt).not.toBeNull()
  expect(endpointRow?.consecutiveFailures).toBe(1)
})

test("a delivery whose retried attempt succeeds ends succeeded", async () => {
  respond = (response, requestNumber) => {
    response.statusCode = requestNumber === 1 ? 503 : 204
    response.end()
  }
  const endpoint = await makeWebhookEndpoint({ url: receiverUrl })
  const delivery = await makeWebhookDelivery({ endpointId: endpoint.id })

  await enqueueDelivery(delivery.id)

  const settled = await waitForSettled(delivery.id)

  expect(settled.status).toBe("succeeded")
  expect(settled.attemptCount).toBe(2)
  expect(settled.lastStatusCode).toBe(204)
})
