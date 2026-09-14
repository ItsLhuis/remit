import { type InferInsertModel } from "drizzle-orm"

import { webhookDeliveries, webhookEndpoints } from "@/database/schema"

import { mintWebhookSecret } from "@/features/webhooks/server"

import { database } from "@/tests/integration/database"

export async function makeWebhookEndpoint(
  overrides?: Partial<InferInsertModel<typeof webhookEndpoints>>
) {
  const [endpoint] = await database
    .insert(webhookEndpoints)
    .values({
      url: "https://hooks.example.com/remit",
      events: ["invoice.paid"],
      secret: mintWebhookSecret(),
      ...overrides
    })
    .returning()

  if (!endpoint) throw new Error("makeWebhookEndpoint: insert failed")

  return endpoint
}

export async function makeWebhookDelivery(
  overrides: Partial<InferInsertModel<typeof webhookDeliveries>> &
    Pick<InferInsertModel<typeof webhookDeliveries>, "endpointId">
) {
  const [delivery] = await database
    .insert(webhookDeliveries)
    .values({
      event: "invoice.paid",
      payload: {
        type: "invoice.paid",
        timestamp: "2026-09-11T08:30:00.000Z",
        data: { invoiceId: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e" }
      },
      ...overrides
    })
    .returning()

  if (!delivery) throw new Error("makeWebhookDelivery: insert failed")

  return delivery
}
