import { createHmac, timingSafeEqual } from "node:crypto"

// The Standard Webhooks signing scheme, chosen over a Remit-specific one so a receiver can verify
// with any of that specification's published libraries rather than code written for Remit alone.
// It is the standard Remit already demands of Stripe: the signature covers the message id, a
// timestamp and the exact body, so a captured delivery cannot be re-sent later (the receiver
// refuses a stale timestamp), altered (the body is signed), or passed off as another message (the
// id is signed, and a receiver deduplicates on it).

export const WEBHOOK_SECRET_PREFIX = "whsec_"

// The specification's recommended tolerance. A receiver refuses anything older or further in the
// future, which bounds how long a captured delivery stays replayable.
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

export type WebhookSignatureInput = {
  messageId: string
  timestampSeconds: number
  body: string
  secret: string
}

export function signWebhookPayload(input: WebhookSignatureInput): string {
  const digest = createHmac("sha256", decodeSecret(input.secret))
    .update(`${input.messageId}.${input.timestampSeconds}.${input.body}`, "utf8")
    .digest("base64")

  return `v1,${digest}`
}

export type WebhookVerificationInput = WebhookSignatureInput & {
  signatureHeader: string
  nowSeconds: number
}

// The receiver's side of the scheme. Remit never receives its own deliveries; this exists so the
// tests prove a delivery verifies and a replay does not, with the same code a receiver would run.
export function verifyWebhookSignature(input: WebhookVerificationInput): boolean {
  if (Math.abs(input.nowSeconds - input.timestampSeconds) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
    return false
  }

  const expected = Buffer.from(signWebhookPayload(input), "utf8")

  return input.signatureHeader.split(" ").some((candidate) => {
    const received = Buffer.from(candidate, "utf8")

    return received.length === expected.length && timingSafeEqual(received, expected)
  })
}

function decodeSecret(secret: string): Buffer {
  const encoded = secret.startsWith(WEBHOOK_SECRET_PREFIX)
    ? secret.slice(WEBHOOK_SECRET_PREFIX.length)
    : secret

  return Buffer.from(encoded, "base64")
}
