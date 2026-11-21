import { eq, sql } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, webhookEndpoints } from "@/database/schema"

import { makeUser, makeWebhookEndpoint } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  enqueueJob: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  revalidatePath: vi.fn()
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

vi.mock("next/headers", () => ({ headers: mocks.headers }))

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }))

vi.mock("@/lib/auth/session", () => ({ getCurrentRole: mocks.getCurrentRole }))

vi.mock("@/lib/jobs", () => ({ enqueueJob: mocks.enqueueJob }))

beforeEach(async () => {
  vi.clearAllMocks()

  const user = await makeUser()

  mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
  mocks.getSession.mockResolvedValue({ user: { id: user.id } })
  mocks.getCurrentRole.mockResolvedValue("owner")
})

describe("webhook settings", () => {
  test("shows the signing secret once and keeps it encrypted at rest", async () => {
    const { createWebhookEndpoint } = await import("../mutations")

    const result = await createWebhookEndpoint({
      url: "https://hooks.example.com/remit?key=query-secret",
      events: ["invoice.paid", "client.created"]
    })

    if ("error" in result) throw new Error(result.error)

    const raw = await database.execute<{ secret: string }>(
      sql`select secret from webhook_endpoints limit 1`
    )

    expect(result.data.secret.startsWith("whsec_")).toBe(true)
    expect(raw[0]?.secret).toBeDefined()
    expect(raw[0]?.secret).not.toBe(result.data.secret)
    expect(JSON.stringify(result.data.endpoint)).not.toContain(result.data.secret)
  })

  test("audits an endpoint by its host rather than by a URL that may carry a token", async () => {
    const { createWebhookEndpoint } = await import("../mutations")

    await createWebhookEndpoint({
      url: "https://hooks.example.com/remit?key=query-secret",
      events: ["invoice.paid"]
    })

    const [entry] = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "webhook.endpoint.created"))

    expect(entry?.metadata).toMatchObject({ host: "hooks.example.com" })
    expect(JSON.stringify(entry)).not.toContain("query-secret")
  })

  test.each([
    ["https://192.168.1.10/hook"],
    ["https://127.0.0.1/hook"],
    ["http://hooks.example.com/hook"],
    ["https://user:pass@hooks.example.com/hook"]
  ])("refuses to save %s", async (url) => {
    const { createWebhookEndpoint } = await import("../mutations")

    const result = await createWebhookEndpoint({ url, events: ["invoice.paid"] })

    expect("error" in result).toBe(true)
    expect(await database.select().from(webhookEndpoints)).toHaveLength(0)
  })

  test("refuses a role other than the owner", async () => {
    mocks.getCurrentRole.mockResolvedValue("assistant")

    const { createWebhookEndpoint } = await import("../mutations")

    const result = await createWebhookEndpoint({
      url: "https://hooks.example.com/remit",
      events: ["invoice.paid"]
    })

    expect("error" in result).toBe(true)
  })

  test("queues a test delivery only for an active endpoint", async () => {
    const { sendWebhookTest } = await import("../mutations")

    const active = await makeWebhookEndpoint()
    const inactive = await makeWebhookEndpoint({ active: false, disabledReason: "manual" })

    const queued = await sendWebhookTest({ endpointId: active.id })
    const refused = await sendWebhookTest({ endpointId: inactive.id })

    expect("data" in queued).toBe(true)
    expect("error" in refused).toBe(true)
    expect(mocks.enqueueJob).toHaveBeenCalledTimes(1)
  })

  test("clears the failure streak when an endpoint the job switched off is re-enabled", async () => {
    const { setWebhookEndpointActive } = await import("../mutations")

    const endpoint = await makeWebhookEndpoint({
      active: false,
      disabledReason: "consecutive_failures",
      consecutiveFailures: 10
    })

    const result = await setWebhookEndpointActive({ endpointId: endpoint.id, active: true })

    const [row] = await database
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, endpoint.id))

    expect("data" in result && result.data.endpoint.status).toBe("active")
    expect(row?.consecutiveFailures).toBe(0)
    expect(row?.disabledReason).toBeNull()
  })

  test("replaces the signing secret on rotation", async () => {
    const { rotateWebhookEndpointSecret } = await import("../mutations")

    const endpoint = await makeWebhookEndpoint()

    const result = await rotateWebhookEndpointSecret({ endpointId: endpoint.id })

    if ("error" in result) throw new Error(result.error)

    const [row] = await database
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, endpoint.id))

    expect(result.data.secret).not.toBe(endpoint.secret)
    expect(row?.secret).toBe(result.data.secret)
  })
})
