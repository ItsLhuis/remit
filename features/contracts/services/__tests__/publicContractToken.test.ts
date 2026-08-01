import { randomBytes } from "node:crypto"

import { expect, test } from "vitest"

import { matchesPublicContractToken } from "../publicContractToken"

test("accepts a candidate identical to the stored token", () => {
  const token = randomBytes(32).toString("base64url")

  const result = matchesPublicContractToken(token, token)

  expect(result).toBe(true)
})

test("rejects a candidate that differs from the stored token", () => {
  const stored = randomBytes(32).toString("base64url")
  const candidate = randomBytes(32).toString("base64url")

  const result = matchesPublicContractToken(candidate, stored)

  expect(result).toBe(false)
})

test("rejects a shorter candidate without throwing on the length mismatch", () => {
  const stored = randomBytes(32).toString("base64url")

  const result = matchesPublicContractToken(stored.slice(0, 10), stored)

  expect(result).toBe(false)
})

test("rejects a longer candidate without throwing on the length mismatch", () => {
  const stored = randomBytes(32).toString("base64url")

  const result = matchesPublicContractToken(`${stored}extra`, stored)

  expect(result).toBe(false)
})

test("rejects an empty candidate against a real stored token", () => {
  const stored = randomBytes(32).toString("base64url")

  const result = matchesPublicContractToken("", stored)

  expect(result).toBe(false)
})
