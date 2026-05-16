import { beforeEach, expect, test, vi } from "vitest"

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

  const { GET } = await import("./route")

  const response = await GET()
  const body = (await response.json()) as { status: string }

  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("no-store")
  expect(body).toEqual({ status: "ok" })
  expect(mocks.loggerError).not.toHaveBeenCalled()
})

test("returns degraded and logs when the database is unreachable", async () => {
  const error = new Error("database unavailable")

  mocks.checkDatabaseConnectivity.mockResolvedValueOnce({
    ok: false,
    reason: "database_unreachable",
    error
  })

  const { GET } = await import("./route")

  const response = await GET()
  const body = (await response.json()) as { status: string; reason: string }

  expect(response.status).toBe(503)
  expect(response.headers.get("Cache-Control")).toBe("no-store")
  expect(body).toEqual({ status: "degraded", reason: "database_unreachable" })
  expect(mocks.loggerError).toHaveBeenCalledWith(
    { action: "api.health.GET", check: "database", err: error },
    "Public health check failed"
  )
})
