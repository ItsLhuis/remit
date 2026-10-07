import { expect, test } from "vitest"

import { isFinalJobAttempt } from "../attempts"

test("is not final while a retry is still budgeted", () => {
  expect(isFinalJobAttempt(5, 6)).toBe(false)
})

test("is final on the attempt that reaches the budget", () => {
  expect(isFinalJobAttempt(6, 6)).toBe(true)
})

test("is final after one attempt when the job was enqueued without a budget", () => {
  expect(isFinalJobAttempt(1, undefined)).toBe(true)
})
