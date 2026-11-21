import IntlMessageFormat from "intl-messageformat"

import { describe, expect, test } from "vitest"

import i18n from "../i18n"
import { Locales } from "../locales"

type Message = {
  key: string
  value: string
}

function collectMessages(tree: object, prefix: string): Message[] {
  return Object.entries(tree).flatMap(([name, value]: [string, unknown]) => {
    const key = prefix ? `${prefix}.${name}` : name

    if (typeof value === "string") return [{ key, value }]
    if (typeof value === "object" && value !== null) return collectMessages(value, key)

    return []
  })
}

// The construction i18next-icu's `parse` performs on every lookup, `ignoreTag` included: without it
// a message carrying `<0>`-style placeholders fails here while rendering fine, and a real syntax
// error could hide behind the difference. The plugin turns a parse failure into the raw string at
// runtime, so this is the only place a malformed message is ever reported.
function findInvalidMessages(): string[] {
  return Object.values(Locales).flatMap((locale) =>
    collectMessages(locale.translations, "").flatMap((message) => {
      try {
        new IntlMessageFormat(message.value, locale.code, undefined, { ignoreTag: true })

        return []
      } catch (error) {
        return [`${locale.code} ${message.key}: ${String(error)}`]
      }
    })
  )
}

describe("locale messages", () => {
  test("every translation in every locale parses as an ICU message", () => {
    const invalid = findInvalidMessages()

    expect(invalid).toEqual([])
  })

  test("formats a plural for one and for many", () => {
    const one = i18n.t("health.dashboard.attentionTitle", { count: 1 })
    const many = i18n.t("health.dashboard.attentionTitle", { count: 3 })

    expect(one).toBe("1 item needs attention")
    expect(many).toBe("3 items need attention")
  })

  test("formats a select by its value and falls back to its other branch", () => {
    const known = i18n.t("activity.messages.projectStatusChanged", {
      name: "Brand refresh",
      status: "on_hold"
    })
    const unknown = i18n.t("activity.messages.projectStatusChanged", {
      name: "Brand refresh",
      status: "archived"
    })

    expect(known).toBe("Project Brand refresh moved to On hold")
    expect(unknown).toBe("Project Brand refresh moved to Unknown")
  })

  test("formats a select and a plural nested in one message", () => {
    const body = i18n.t("proposals.public.email.body", {
      name: "Sam",
      issuer: "Acme",
      number: "PRO-0007",
      action: "decline",
      code: "123456",
      minutes: 1
    })

    expect(body).toContain("confirm that you want to decline it")
    expect(body).toContain("expires in 1 minute and")
  })

  test("formats a number argument with the locale's grouping", () => {
    const pagination = i18n.t("activity.feed.pagination", { page: 2, pageCount: 1200 })

    expect(pagination).toBe("Page 2 of 1,200")
  })
})
