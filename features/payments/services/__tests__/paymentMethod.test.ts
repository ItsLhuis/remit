import { expect, test } from "vitest"

import { isManualPaymentMethod, toManualPaymentMethod } from "../paymentMethod"

test("treats a hand-keyed method as manual", () => {
  expect(isManualPaymentMethod("bank_transfer")).toBe(true)
  expect(isManualPaymentMethod("cash")).toBe(true)
  expect(isManualPaymentMethod("other")).toBe(true)
})

test("does not treat a provider-written method as manual", () => {
  expect(isManualPaymentMethod("stripe")).toBe(false)
})

test("keeps a manual method unchanged when seeding the edit form", () => {
  expect(toManualPaymentMethod("cash")).toBe("cash")
})

test("collapses a provider-written method to other when seeding the edit form", () => {
  expect(toManualPaymentMethod("stripe")).toBe("other")
})
