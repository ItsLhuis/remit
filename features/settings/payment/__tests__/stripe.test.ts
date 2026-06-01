import { beforeEach, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  balanceRetrieve: vi.fn(),
  stripeConstructor: vi.fn()
}))

vi.mock("stripe", () => ({
  default: class MockStripe {
    balance = {
      retrieve: mocks.balanceRetrieve
    }

    constructor(secretKey: string, options: unknown) {
      mocks.stripeConstructor(secretKey, options)
    }
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.balanceRetrieve.mockResolvedValue({})
})

test("retrieves the Stripe balance with the submitted secret key", async () => {
  const { testStripeConnection } = await import("../stripe")

  await testStripeConnection("sk_test_boundary")

  expect(mocks.stripeConstructor).toHaveBeenCalledWith(
    "sk_test_boundary",
    expect.objectContaining({
      apiVersion: "2026-05-27.dahlia",
      maxNetworkRetries: 1,
      timeout: 10000
    })
  )
  expect(mocks.balanceRetrieve).toHaveBeenCalledOnce()
})

test("maps Stripe authentication failures to a sanitized error code", async () => {
  const { testStripeConnection } = await import("../stripe")

  mocks.balanceRetrieve.mockRejectedValueOnce({ type: "StripeAuthenticationError" })

  await expect(testStripeConnection("sk_test_invalid")).rejects.toMatchObject({
    code: "auth",
    stripeErrorType: "StripeAuthenticationError"
  })
})
