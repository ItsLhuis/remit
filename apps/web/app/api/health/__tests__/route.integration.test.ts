import { expect, test } from "vitest"

import pkg from "@/package.json"

test("returns ok when the integration database is reachable", async () => {
  const { GET } = await import("../route")

  const response = await GET()
  const body = (await response.json()) as { ok: boolean; version: string }

  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("no-store")
  expect(body).toEqual({ ok: true, version: pkg.version })
})
