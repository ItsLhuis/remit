import { expect, test } from "vitest"

import { escapeHtml } from "../html"

test("escapes every html-significant character", () => {
  expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;")
})

test("returns text without html-significant characters unchanged", () => {
  expect(escapeHtml("Invoice 42")).toBe("Invoice 42")
})
