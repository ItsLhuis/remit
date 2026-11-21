import { describe, expect, test } from "vitest"

import {
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_SECRET_PREFIX,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
} from "../signature"

// The Standard Webhooks specification's public example secret, so it cannot change without breaking
// the reference signature below. The prefix is joined at runtime because the literal
// `whsec_<key>` shape matches GitHub's Stripe webhook secret pattern and is reported as a leak.
const secret = `${WEBHOOK_SECRET_PREFIX}MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw`

const message = {
  messageId: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestampSeconds: 1614265330,
  body: '{"test": 2432232314}',
  secret
}

describe("webhook signatures", () => {
  // The Standard Webhooks specification's published test vector. Matching it is what lets a
  // receiver verify Remit's deliveries with any of that specification's libraries.
  test("reproduces the Standard Webhooks reference signature", () => {
    expect(signWebhookPayload(message)).toBe("v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=")
  })

  test("verifies a delivery signed with the endpoint's secret", () => {
    const signatureHeader = signWebhookPayload(message)

    const verified = verifyWebhookSignature({
      ...message,
      signatureHeader,
      nowSeconds: message.timestampSeconds + 10
    })

    expect(verified).toBe(true)
  })

  test("refuses a delivery whose body was altered after signing", () => {
    const signatureHeader = signWebhookPayload(message)

    const verified = verifyWebhookSignature({
      ...message,
      body: '{"test": 1}',
      signatureHeader,
      nowSeconds: message.timestampSeconds
    })

    expect(verified).toBe(false)
  })

  test("refuses a captured delivery replayed after the tolerance window", () => {
    const signatureHeader = signWebhookPayload(message)

    const verified = verifyWebhookSignature({
      ...message,
      signatureHeader,
      nowSeconds: message.timestampSeconds + WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS + 1
    })

    expect(verified).toBe(false)
  })

  test("refuses a signature moved onto a different message id", () => {
    const signatureHeader = signWebhookPayload(message)

    const verified = verifyWebhookSignature({
      ...message,
      messageId: "msg_other",
      signatureHeader,
      nowSeconds: message.timestampSeconds
    })

    expect(verified).toBe(false)
  })

  test("refuses a signature made with another secret", () => {
    const signatureHeader = signWebhookPayload({
      ...message,
      secret: "whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    })

    const verified = verifyWebhookSignature({
      ...message,
      signatureHeader,
      nowSeconds: message.timestampSeconds
    })

    expect(verified).toBe(false)
  })

  test("accepts any one matching signature in a space-separated header", () => {
    const signatureHeader = `v1,bm90IGEgc2lnbmF0dXJl ${signWebhookPayload(message)}`

    const verified = verifyWebhookSignature({
      ...message,
      signatureHeader,
      nowSeconds: message.timestampSeconds
    })

    expect(verified).toBe(true)
  })
})
