import { afterEach, beforeEach, expect, test, vi, type Mock } from "vitest"

import { envSchema } from "@/lib/config/envSchema"

import { buildErrorEvent } from "../errorEvent"

const mocks = vi.hoisted(() => ({
  logger: { fatal: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  startErrorTracking: vi.fn()
}))

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }))

vi.mock("@/lib/errorTracking", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/errorTracking")>()

  mocks.startErrorTracking.mockImplementation(original.startErrorTracking)

  return { ...original, startErrorTracking: mocks.startErrorTracking }
})

// An environment that fails validation on its encryption key while every other value, including a
// usable DSN, is present: the case where a sender could exist in principle and the event it would
// carry is the environment itself.
const INVALID_ENVIRONMENT = {
  NEXT_RUNTIME: "nodejs",
  SENTRY_DSN: "https://0123456789abcdef0123456789abcdef@errors.example.com/7",
  DATABASE_URL: "postgresql://remit:db-password-3kD9@database:5432/remit",
  REDIS_URL: "redis://:redis-password-8sK2@redis:6379",
  BETTER_AUTH_SECRET: "better-auth-secret-7yHn3Kd",
  REMIT_PUBLIC_URL: "https://remit.example.com",
  REMIT_ENCRYPTION_KEY: "not-a-key-but-a-secret-anyway-9Qm2",
  MINIO_ENDPOINT: "http://minio:9000",
  MINIO_ROOT_USER: "remit",
  MINIO_ROOT_PASSWORD: "minio-root-password-5Lp0"
}

const SECRET_VALUES = [
  "db-password-3kD9",
  "redis-password-8sK2",
  "better-auth-secret-7yHn3Kd",
  "not-a-key-but-a-secret-anyway-9Qm2",
  "minio-root-password-5Lp0",
  "0123456789abcdef0123456789abcdef"
]

let fetchMock: Mock<typeof fetch>

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }))

  vi.stubGlobal("fetch", fetchMock)

  for (const [key, value] of Object.entries(INVALID_ENVIRONMENT)) vi.stubEnv(key, value)

  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${String(code)})`)
  })

  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

test("a server whose environment fails validation exits before any sender exists", async () => {
  const { register } = await import("@/instrumentation")

  await expect(register()).rejects.toThrow("process.exit(1)")

  expect(mocks.startErrorTracking).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
})

test("the validation failure the server logs names variables and never their values", async () => {
  const { register } = await import("@/instrumentation")

  await expect(register()).rejects.toThrow()

  const logged = JSON.stringify(mocks.logger.fatal.mock.calls)

  expect(logged).toContain("REMIT_ENCRYPTION_KEY")

  for (const value of SECRET_VALUES) expect(logged).not.toContain(value)
})

test("the error a failed validation produces transmits none of the environment if reported", () => {
  const parsed = envSchema.safeParse(INVALID_ENVIRONMENT)

  expect(parsed.success).toBe(false)

  const error = new Error(`Invalid environment: ${JSON.stringify(INVALID_ENVIRONMENT)}`, {
    cause: parsed.error
  })

  const event = buildErrorEvent(
    { error, context: { source: "process", phase: "start" } },
    {
      eventId: "fedcba9876543210fedcba9876543210",
      timestamp: 1_758_000_000,
      release: "1.0.0",
      environment: "production",
      runtime: "worker",
      cwd: "/app"
    }
  )

  const text = JSON.stringify(event)

  expect(event).not.toBeNull()

  for (const value of SECRET_VALUES) expect(text).not.toContain(value)
})
