import { expect, test } from "vitest"

import { makeSettings } from "@/tests/factories"

import { getPublicPaymentBlock } from "../queries"

test("returns a public payment block without exposing the full IBAN", async () => {
  await makeSettings({
    paymentBankName: "Acme Bank",
    paymentIban: "GB82WEST12345698765432",
    paymentInstructions: "Use the invoice number as the transfer reference.",
    stripeSecretKey: "sk_test_never_public"
  })

  const result = await getPublicPaymentBlock()

  expect(result).toEqual({
    bankName: "Acme Bank",
    paymentIbanDisplay: "GB82 ... 5432",
    paymentInstructions: "Use the invoice number as the transfer reference.",
    hasBankTransferDetails: true
  })
  expect(JSON.stringify(result)).not.toContain("GB82WEST12345698765432")
  expect(JSON.stringify(result)).not.toContain("sk_test_never_public")
})
