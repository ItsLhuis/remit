import { expect, test } from "vitest"

import { isContractExpired, resolveContractDisplayStatus } from "../contractExpiry"

const now = new Date("2026-07-31T12:00:00.000Z")

test("is not expired when no end date is set", () => {
  expect(isContractExpired(null, now)).toBe(false)
})

test("is not expired on the last effective day", () => {
  expect(isContractExpired(new Date("2026-07-31T00:00:00.000Z"), now)).toBe(false)
})

test("is expired once the UTC date has moved past the end date", () => {
  expect(isContractExpired(new Date("2026-07-30T00:00:00.000Z"), now)).toBe(true)
})

test("derives expired for a sent contract whose window closed", () => {
  expect(resolveContractDisplayStatus("sent", new Date("2026-07-30T00:00:00.000Z"), now)).toBe(
    "expired"
  )
})

test("keeps a signed contract signed after its window closes", () => {
  expect(resolveContractDisplayStatus("signed", new Date("2026-07-30T00:00:00.000Z"), now)).toBe(
    "signed"
  )
})

test("keeps a draft a draft even with a past end date", () => {
  expect(resolveContractDisplayStatus("draft", new Date("2026-07-30T00:00:00.000Z"), now)).toBe(
    "draft"
  )
})

test("keeps a terminated contract terminated", () => {
  expect(
    resolveContractDisplayStatus("terminated", new Date("2026-07-30T00:00:00.000Z"), now)
  ).toBe("terminated")
})
