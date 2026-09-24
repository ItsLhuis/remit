import { describe, expect, test } from "vitest"

import { isValidIban, maskIbanForDisplay, normalizeIban } from "../iban"

describe("isValidIban", () => {
  test("accepts a valid IBAN however it is spaced or cased", () => {
    expect(isValidIban("GB82WEST12345698765432")).toBe(true)
    expect(isValidIban("gb82 west 1234 5698 7654 32")).toBe(true)
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true)
  })

  test("refuses an IBAN whose check digits do not match its account", () => {
    expect(isValidIban("GB83WEST12345698765432")).toBe(false)
    expect(isValidIban("DE89370400440532013001")).toBe(false)
  })

  test("refuses a value that is not shaped like an IBAN", () => {
    expect(isValidIban("")).toBe(false)
    expect(isValidIban("GB82WEST")).toBe(false)
    expect(isValidIban("1282WEST12345698765432")).toBe(false)
    expect(isValidIban("GB82-WEST-1234-5698-7654-32")).toBe(false)
  })
})

describe("normalizeIban", () => {
  test("removes every space and uppercases the letters", () => {
    expect(normalizeIban(" gb82 west\t1234 ")).toBe("GB82WEST1234")
  })
})

describe("maskIbanForDisplay", () => {
  test("shows only the country, check digits and last four characters", () => {
    expect(maskIbanForDisplay("gb82 west 1234 5698 7654 32")).toBe("GB82 ... 5432")
  })

  test("shows nothing for a stored value that is not a valid IBAN", () => {
    expect(maskIbanForDisplay("GB83WEST12345698765432")).toBeNull()
  })
})
