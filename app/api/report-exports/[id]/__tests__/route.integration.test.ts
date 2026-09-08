import { beforeEach, expect, test, vi } from "vitest"

import { makeReportExport, makeUser } from "@/tests/factories"

const mocks = vi.hoisted(() => ({
  getCurrentRole: vi.fn(),
  getExportObjectStream: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn()
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

vi.mock("@/lib/storage/s3", () => ({
  getExportObjectStream: mocks.getExportObjectStream
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-0000000006b1"

async function makeReadyExport() {
  return await makeReportExport({
    status: "ready",
    storageKey: "report-exports/key/revenue-by-client-2026-03-31.pdf"
  })
}

beforeEach(async () => {
  vi.clearAllMocks()

  await makeUser({ id: ownerId, email: "owner-route@example.com", name: "Ada Owner" })

  mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
  mocks.getSession.mockResolvedValue({ user: { id: ownerId, name: "Ada Owner" } })
  mocks.getCurrentRole.mockResolvedValue("owner")
  mocks.getExportObjectStream.mockResolvedValue({
    body: new ReadableStream(),
    contentLength: 1024
  })
})

test("refuses an unauthenticated request and reads no object", async () => {
  mocks.getSession.mockResolvedValue(null)

  const row = await makeReadyExport()
  const { GET } = await import("../route")

  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: row.id })
  })

  expect(response.status).toBe(401)
  expect(mocks.getExportObjectStream).not.toHaveBeenCalled()
})

test("answers a role that may not export as though the export did not exist", async () => {
  mocks.getCurrentRole.mockResolvedValue("assistant")

  const row = await makeReadyExport()
  const { GET } = await import("../route")

  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: row.id })
  })

  expect(response.status).toBe(404)
  expect(mocks.getExportObjectStream).not.toHaveBeenCalled()
})

test("does not serve an export that has not finished rendering", async () => {
  const row = await makeReportExport()
  const { GET } = await import("../route")

  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: row.id })
  })

  expect(response.status).toBe(404)
  expect(mocks.getExportObjectStream).not.toHaveBeenCalled()
})

test("serves the finished PDF as a named attachment that is never cached or indexed", async () => {
  const row = await makeReadyExport()
  const { GET } = await import("../route")

  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: row.id })
  })

  expect(response.status).toBe(200)
  expect(response.headers.get("Content-Type")).toBe("application/pdf")
  expect(response.headers.get("Content-Disposition")).toContain("revenue-by-client-")
  expect(response.headers.get("Cache-Control")).toBe("no-store")
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
})
