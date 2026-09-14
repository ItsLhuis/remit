import { expect, test } from "vitest"

import { getWebhookEndpointStatus } from "../endpointStatus"

test("reports an active endpoint as active whatever reason was left behind", () => {
  expect(getWebhookEndpointStatus({ active: true, disabledReason: null })).toBe("active")
})

test("tells the delivery job's switch-off apart from the owner's", () => {
  expect(getWebhookEndpointStatus({ active: false, disabledReason: "consecutive_failures" })).toBe(
    "failing"
  )
  expect(getWebhookEndpointStatus({ active: false, disabledReason: "manual" })).toBe("disabled")
})
