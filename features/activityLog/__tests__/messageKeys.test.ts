import { describe, expect, test } from "vitest"

import i18n from "@/lib/i18n/i18n"

import { activityMessagePresentation, isActivityMessageKey } from "../labels"

describe("activity message keys", () => {
  // The compiler already forces the presentation map to cover exactly the `activity.messages` block
  // of `Translations`. What it cannot see is the locale file behind that type, so this walks every
  // key the write path can store and asserts a real message exists to render it.
  test.each(Object.keys(activityMessagePresentation))("%s resolves to a translation", (key) => {
    expect(i18n.exists(key)).toBe(true)
  })

  test("accepts a key the presentation map carries", () => {
    expect(isActivityMessageKey("activity.messages.invoicePaid")).toBe(true)
  })

  test("rejects a key that is not an activity message", () => {
    expect(isActivityMessageKey("errors.somethingWentWrong")).toBe(false)
    expect(isActivityMessageKey("activity.messages.retiredMessage")).toBe(false)
  })
})
