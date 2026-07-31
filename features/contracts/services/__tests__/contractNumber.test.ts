import { expect, test } from "vitest"

import { formatContractNumber } from "../contractNumber"

test("pads the sequence to the configured width", () => {
  expect(formatContractNumber({ prefix: "CTR-", nextNumber: 42, paddingWidth: 4 })).toBe("CTR-0042")
})

test("never truncates a sequence wider than the padding", () => {
  expect(formatContractNumber({ prefix: "CTR-", nextNumber: 100000, paddingWidth: 4 })).toBe(
    "CTR-100000"
  )
})

test("increments produce distinct consecutive numbers", () => {
  const first = formatContractNumber({ prefix: "CTR-", nextNumber: 1, paddingWidth: 4 })
  const second = formatContractNumber({ prefix: "CTR-", nextNumber: 2, paddingWidth: 4 })

  expect([first, second]).toEqual(["CTR-0001", "CTR-0002"])
})
