import Stripe from "stripe"

export type StripeConnectionTestErrorCode =
  | "api"
  | "auth"
  | "connection"
  | "permission"
  | "provider_failed"
  | "rate_limit"
  | "rejected"

export class StripeConnectionTestError extends Error {
  constructor(
    readonly code: StripeConnectionTestErrorCode,
    readonly stripeErrorType: string | null
  ) {
    super(code)
    this.name = "StripeConnectionTestError"
  }
}

// Pinned rather than left to the SDK default, so Stripe rolling its API forward cannot change what
// this instance sends or how it reads a response without a deliberate edit here.
const STRIPE_API_VERSION = "2026-05-27.dahlia"
// A person is watching a settings form while this runs, so it fails fast: one retry and a short
// timeout, unlike the webhook path, where the SDK's usual patience is what a caller wants.
const STRIPE_TEST_TIMEOUT_MS = 10_000

export async function testStripeConnection(secretKey: string): Promise<void> {
  const stripe = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 1,
    timeout: STRIPE_TEST_TIMEOUT_MS
  })

  try {
    await stripe.balance.retrieve()
  } catch (error) {
    throw new StripeConnectionTestError(mapStripeError(error), getStripeErrorType(error))
  }
}

function mapStripeError(error: unknown): StripeConnectionTestErrorCode {
  const type = getStripeErrorType(error)

  switch (type) {
    case "StripeAuthenticationError":
      return "auth"
    case "StripePermissionError":
      return "permission"
    case "StripeRateLimitError":
      return "rate_limit"
    case "StripeConnectionError":
      return "connection"
    case "StripeInvalidRequestError":
      return "rejected"
    case "StripeAPIError":
      return "api"
    case null:
      return "provider_failed"
    default:
      return "provider_failed"
  }
}

function getStripeErrorType(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("type" in error)) return null

  const type = error.type

  return typeof type === "string" ? type : null
}
