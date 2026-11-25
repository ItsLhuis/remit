import { expect, test } from "vitest"

import { FORMATTING_LOCALES, isFormattingLocale } from "../locale"

test("accepts a regional tag from the list and refuses anything else", () => {
  expect(isFormattingLocale("pt-PT")).toBe(true)
  expect(isFormattingLocale("pt")).toBe(false)
  expect(isFormattingLocale("pt_PT")).toBe(false)
  expect(isFormattingLocale("")).toBe(false)
})

test("lists only tags that Intl formats as their own locale rather than a fallback", () => {
  const unsupported = FORMATTING_LOCALES.filter(
    (locale) => Intl.NumberFormat.supportedLocalesOf(locale).length !== 1
  )

  expect(unsupported).toEqual([])
})
