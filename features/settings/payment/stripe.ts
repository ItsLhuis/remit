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

const STRIPE_API_VERSION = "2026-05-27.dahlia"
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
