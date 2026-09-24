import { describe, expect, test } from "vitest"

import { authoredText, createRenderContext, formatMergeValue, mergeValue } from "../renderContext"

describe("mergeValue", () => {
  test("merges a whitelisted variable escaped for html", () => {
    const context = createRenderContext(
      { values: { "client.name": "Smith & <Sons>" } },
      "invoice",
      "html",
      {}
    )

    expect(mergeValue(context, "client.name")).toBe("Smith &amp; &lt;Sons&gt;")
  })

  test("merges a whitelisted variable as written for plain text", () => {
    const context = createRenderContext(
      { values: { "client.name": "Smith & <Sons>" } },
      "invoice",
      "text",
      {}
    )

    expect(mergeValue(context, "client.name")).toBe("Smith & <Sons>")
  })

  test("merges nothing for an identifier outside the template type's whitelist", () => {
    const context = createRenderContext(
      { values: { "payment.iban": "GB82WEST12345698765432" } },
      "proposal",
      "html",
      {}
    )

    expect(mergeValue(context, "payment.iban")).toBe("")
    expect(mergeValue(context, undefined)).toBe("")
  })
})

describe("authoredText", () => {
  test("escapes authored text for html and leaves it as written for plain text", () => {
    const html = createRenderContext({ values: {} }, "invoice", "html", {})
    const text = createRenderContext({ values: {} }, "invoice", "text", {})

    expect(authoredText(html, "Logo <b>")).toBe("Logo &lt;b&gt;")
    expect(authoredText(text, "Logo <b>")).toBe("Logo <b>")
  })
})

describe("formatMergeValue", () => {
  test("merges numbers and booleans as their string form", () => {
    expect(formatMergeValue(42)).toBe("42")
    expect(formatMergeValue(false)).toBe("false")
  })

  test("merges an absent or structured value as empty rather than as its debug form", () => {
    expect(formatMergeValue(undefined)).toBe("")
    expect(formatMergeValue(null)).toBe("")
    expect(formatMergeValue({ amount: 1 })).toBe("")
  })
})
