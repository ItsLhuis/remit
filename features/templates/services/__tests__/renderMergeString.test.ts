import { describe, expect, test } from "vitest"

import { renderMergeString } from "../renderMergeString"

const renderData = {
  values: {
    "invoice.number": "INV-0001",
    "client.name": "O'Brien & Sons",
    "payment.iban": "SECRET"
  }
}

describe("renderMergeString", () => {
  test("substitutes whitelisted tokens", () => {
    expect(renderMergeString("Invoice {{invoice.number}}", renderData, "email_invoice_send")).toBe(
      "Invoice INV-0001"
    )
  })

  // A subject line is a header value, not markup: escaping would put `&#39;` in the subject bar.
  test("leaves values unescaped", () => {
    expect(renderMergeString("{{client.name}}", renderData, "email_invoice_send")).toBe(
      "O'Brien & Sons"
    )
  })

  // The email whitelist omits the payment group, so bank details cannot be pulled into a subject
  // line even by an operator who types the token by hand.
  test("resolves a token outside the type's whitelist to empty", () => {
    expect(renderMergeString("{{payment.iban}}", renderData, "email_invoice_send")).toBe("")
  })

  test("leaves an unknown identifier empty rather than evaluating it", () => {
    expect(renderMergeString("{{process.env}}", renderData, "email_invoice_send")).toBe("")
  })
})
