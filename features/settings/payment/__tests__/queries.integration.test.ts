import { expect, test } from "vitest"

import { makeSettings } from "@/tests/factories"

import { getPublicPaymentBlock } from "../queries"

test("returns a public payment block without exposing the full IBAN", async () => {
  await makeSettings({
    paymentBankName: "Acme Bank",
    paymentIban: "GB82WEST12345698765432",
    paymentInstructions: "Use the invoice number as the transfer reference.",
    stripeSecretKey: "sk_test_never_public",
    stripeWebhookSecret: "whsec_never_public"
  })

  const result = await getPublicPaymentBlock()

  expect(result).toEqual({
    bankName: "Acme Bank",
    paymentIbanDisplay: "GB82 ... 5432",
    paymentInstructions: "Use the invoice number as the transfer reference.",
    hasBankTransferDetails: true,
    stripeConfigured: true
  })
  expect(JSON.stringify(result)).not.toContain("GB82WEST12345698765432")
  expect(JSON.stringify(result)).not.toContain("sk_test_never_public")
  expect(JSON.stringify(result)).not.toContain("whsec_never_public")
})

test("reports Stripe as unconfigured when no secret key is stored", async () => {
  await makeSettings({ paymentBankName: "Acme Bank" })

  const result = await getPublicPaymentBlock()

  expect(result.stripeConfigured).toBe(false)
})

// `stripeConfigured` gates the pay affordance on an anonymous invoice, and it means what
// `getStripeConfiguration` in `features/payments/stripeWebhook.ts` means: both secrets. A secret key
// alone can open a Checkout Session and charge a client, with no webhook secret to verify the event
// that would record the payment.
test("reports Stripe as unconfigured when the webhook signing secret is missing", async () => {
  await makeSettings({ paymentBankName: "Acme Bank", stripeSecretKey: "sk_test_never_public" })

  const result = await getPublicPaymentBlock()

  expect(result.stripeConfigured).toBe(false)
})
