import { eq } from "drizzle-orm"

import { beforeEach, expect, test, vi } from "vitest"

import { emit } from "@/lib/events"

import { webhookDeliveries } from "@/database/schema"

import { makeWebhookEndpoint } from "@/tests/factories"
import { database } from "@/tests/integration/database"

import { WEBHOOK_BACKOFF_DELAY_MS, WEBHOOK_MAX_ATTEMPTS } from "../services/deliveryPolicy"

const mocks = vi.hoisted(() => ({
  enqueueJob: vi.fn()
}))

vi.mock("@/lib/jobs", () => ({
  enqueueJob: mocks.enqueueJob
}))

beforeEach(async () => {
  mocks.enqueueJob.mockReset()

  await import("../events")
})

test("queues one delivery per active subscribed endpoint and none for the others when an event fires", async () => {
  const subscribed = await makeWebhookEndpoint({ events: ["invoice.paid"] })
  const unsubscribed = await makeWebhookEndpoint({ events: ["client.created"] })
  const disabled = await makeWebhookEndpoint({
    events: ["invoice.paid"],
    active: false,
    disabledReason: "manual"
  })

  await emit("invoice.paid", {
    invoiceId: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
    userId: "5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a"
  })

  const rows = await database.select().from(webhookDeliveries)

  expect(rows.map((row) => row.endpointId)).toEqual([subscribed.id])
  expect(rows.map((row) => row.endpointId)).not.toContain(unsubscribed.id)
  expect(rows.map((row) => row.endpointId)).not.toContain(disabled.id)
})

test("relays record ids only and queues the delivery as a retrying job", async () => {
  const endpoint = await makeWebhookEndpoint({ events: ["invoice.paid"] })

  await emit("invoice.paid", {
    invoiceId: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
    userId: "5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a"
  })

  const [row] = await database
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.endpointId, endpoint.id))

  expect(row?.payload).toMatchObject({
    type: "invoice.paid",
    data: { invoiceId: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e" }
  })
  expect(JSON.stringify(row?.payload)).not.toContain("5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a")
  expect(mocks.enqueueJob).toHaveBeenCalledWith(
    "webhook.delivery.send",
    { deliveryId: row?.id },
    {
      jobId: `webhook-delivery-${row?.id}`,
      attempts: WEBHOOK_MAX_ATTEMPTS,
      backoffDelayMs: WEBHOOK_BACKOFF_DELAY_MS
    }
  )
})
