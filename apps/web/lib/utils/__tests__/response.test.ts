import { expect, test } from "vitest"

import { noindexJson } from "../response"

test("serialises the body as JSON with the given status", async () => {
  const body = { error: "Not found" }

  const response = noindexJson(body, 404)

  expect(response.status).toBe(404)
  expect(response.headers.get("content-type")).toContain("application/json")
  expect(await response.json()).toEqual(body)
})

test("forbids indexing and link following on every response", () => {
  const response = noindexJson({ received: true }, 200)

  expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
})
