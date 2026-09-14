import { describe, expect, test } from "vitest"

import {
  classifyHttpStatus,
  decideWebhookDelivery,
  shouldDisableWebhookEndpoint,
  WEBHOOK_DISABLE_AFTER_FAILURES,
  WEBHOOK_MAX_ATTEMPTS
} from "../deliveryPolicy"

describe("webhook delivery policy", () => {
  test.each([
    [200, "delivered"],
    [204, "delivered"],
    [301, "redirect"],
    [307, "redirect"],
    [400, "http_error"],
    [410, "http_error"],
    [503, "http_error"]
  ] as const)("classifies HTTP %i as %s", (statusCode, outcome) => {
    expect(classifyHttpStatus(statusCode)).toBe(outcome)
  })

  test("marks a delivered attempt succeeded", () => {
    expect(decideWebhookDelivery("delivered", 1)).toBe("succeeded")
  })

  test.each([["redirect"], ["blocked"], ["endpoint_inactive"]] as const)(
    "fails a %s attempt at once because retrying cannot change the answer",
    (outcome) => {
      expect(decideWebhookDelivery(outcome, 1)).toBe("failed")
    }
  )

  test("retries a transient failure until the attempt bound and fails on the last attempt", () => {
    for (let attempt = 1; attempt < WEBHOOK_MAX_ATTEMPTS; attempt++) {
      expect(decideWebhookDelivery("timeout", attempt)).toBe("retry")
    }

    expect(decideWebhookDelivery("http_error", WEBHOOK_MAX_ATTEMPTS)).toBe("failed")
  })

  test("switches an endpoint off only once its failure streak reaches the threshold", () => {
    expect(shouldDisableWebhookEndpoint(WEBHOOK_DISABLE_AFTER_FAILURES - 1)).toBe(false)
    expect(shouldDisableWebhookEndpoint(WEBHOOK_DISABLE_AFTER_FAILURES)).toBe(true)
  })
})
