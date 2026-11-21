import { expect, test } from "vitest"

import { buildWebhookPayload, buildWebhookTestPayload } from "../payload"

const occurredAt = new Date("2026-09-11T08:30:00.000Z")

test("carries record ids and drops who acted and what they changed when an event is relayed", () => {
  const payload = buildWebhookPayload(
    "invoice.created",
    {
      invoiceId: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
      projectId: null,
      clientId: "8f7c3c8e-2d6a-4f1e-9b5a-1c2d3e4f5a6b",
      userId: "5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a"
    },
    occurredAt
  )

  expect(payload).toEqual({
    type: "invoice.created",
    timestamp: "2026-09-11T08:30:00.000Z",
    data: {
      invoiceId: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
      projectId: null,
      clientId: "8f7c3c8e-2d6a-4f1e-9b5a-1c2d3e4f5a6b"
    }
  })
})

test("never forwards the list of changed fields when an update is relayed", () => {
  const payload = buildWebhookPayload(
    "client.updated",
    {
      clientId: "8f7c3c8e-2d6a-4f1e-9b5a-1c2d3e4f5a6b",
      userId: "5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a",
      changedFields: ["notes"]
    },
    occurredAt
  )

  expect(payload.data).toEqual({ clientId: "8f7c3c8e-2d6a-4f1e-9b5a-1c2d3e4f5a6b" })
})

test("sends an empty data object when a test delivery is built", () => {
  expect(buildWebhookTestPayload("webhook.test", occurredAt)).toEqual({
    type: "webhook.test",
    timestamp: "2026-09-11T08:30:00.000Z",
    data: {}
  })
})
