import { beforeEach, expect, test, vi } from "vitest"

import pkg from "@/package.json"

const mocks = vi.hoisted(() => ({
  checkDatabaseConnectivity: vi.fn(),
  loggerError: vi.fn()
}))

vi.mock("@/features/health/server", () => ({
  checkDatabaseConnectivity: mocks.checkDatabaseConnectivity
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
})

test("returns ok and disables caching when the database is reachable", async () => {
  mocks.checkDatabaseConnectivity.mockResolvedValueOnce({ ok: true })

  const { GET } = await import("../route")

  const response = await GET()
  const body = (await response.json()) as { ok: boolean; version: string }

  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("no-store")
  expect(body).toEqual({ ok: true, version: pkg.version })
  expect(mocks.loggerError).not.toHaveBeenCalled()
})

test("returns degraded and logs when the database is unreachable", async () => {
  const error = new Error("database unavailable")

  mocks.checkDatabaseConnectivity.mockResolvedValueOnce({
    ok: false,
    reason: "database_unreachable",
    error
  })

  const { GET } = await import("../route")

  const response = await GET()
  const body = (await response.json()) as { ok: boolean; reason: string }

  expect(response.status).toBe(503)
  expect(response.headers.get("Cache-Control")).toBe("no-store")
  expect(body).toEqual({ ok: false, reason: "database_unreachable" })
  expect(mocks.loggerError).toHaveBeenCalledWith(
    { action: "api.health.GET", check: "database", reason: "database_unreachable" },
    "Public health check failed"
  )
})
