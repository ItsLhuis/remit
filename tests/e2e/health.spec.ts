import { expect, test } from "@playwright/test"

test("GET /api/health returns status ok", async ({ request }) => {
  const response = await request.get("/api/health")

  expect(response.status()).toBe(200)

  const body = await response.json()

  expect(body).toEqual({ status: "ok" })
})
