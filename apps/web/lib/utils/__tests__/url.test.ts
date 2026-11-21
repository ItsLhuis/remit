import { expect, test } from "vitest"

import { isSafeHttpUrl } from "../url"

test("accepts http and https urls", () => {
  expect(isSafeHttpUrl("http://example.com")).toBe(true)
  expect(isSafeHttpUrl("https://example.com/path?q=1")).toBe(true)
})

test("rejects javascript and data scheme urls", () => {
  expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false)
  expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false)
})

test("rejects other schemes such as mailto, tel, and ftp", () => {
  expect(isSafeHttpUrl("mailto:user@example.com")).toBe(false)
  expect(isSafeHttpUrl("tel:+15550100")).toBe(false)
  expect(isSafeHttpUrl("ftp://example.com")).toBe(false)
})

test("rejects values that are not valid urls", () => {
  expect(isSafeHttpUrl("")).toBe(false)
  expect(isSafeHttpUrl("example.com")).toBe(false)
  expect(isSafeHttpUrl("not a url")).toBe(false)
})
