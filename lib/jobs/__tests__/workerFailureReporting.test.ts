import { afterEach, beforeEach, expect, test, vi } from "vitest"

type FailedHandler = (
  job:
    | {
        name: string
        id: string
        attemptsMade: number
        opts: { attempts?: number }
        data?: unknown
      }
    | undefined,
  error: Error
) => void

const mocks = vi.hoisted(() => ({
  getJobExhaustedHandler: vi.fn((): ((payload: unknown) => Promise<void>) | null => null),
  handlers: new Map<string, (...args: unknown[]) => void>(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  reportError: vi.fn(() => "0123456789abcdef0123456789abcdef"),
  recordScheduledJobOutcome: vi.fn(async () => undefined)
}))

vi.mock("bullmq", () => ({
  Worker: class {
    on(event: string, handler: (...args: unknown[]) => void) {
      mocks.handlers.set(event, handler)

      return this
    }

    async close() {}
  }
}))

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }))

vi.mock("@/lib/errorTracking", () => ({ reportError: mocks.reportError }))

vi.mock("../connection", () => ({ createRedisConnection: vi.fn() }))

vi.mock("../queue", () => ({ QUEUE_NAME: "remit", closeQueue: vi.fn(async () => undefined) }))

vi.mock("../registry", () => ({
  getJobExhaustedHandler: mocks.getJobExhaustedHandler,
  getJobHandler: vi.fn(),
  getRegisteredJobNames: vi.fn(() => [])
}))

vi.mock("../schedules", () => ({ registerRepeatableJobs: vi.fn(async () => undefined) }))

vi.mock("../stats", () => ({
  closeStatsConnection: vi.fn(async () => undefined),
  recordScheduledJobOutcome: mocks.recordScheduledJobOutcome
}))

const RENDER_JOB = { name: "invoice.pdf.render", id: "invoice-pdf-3f2a1b9c", opts: { attempts: 5 } }

async function startAndGetFailedHandler(): Promise<FailedHandler> {
  const { startWorker } = await import("../worker")

  await startWorker()

  const handler = mocks.handlers.get("failed")

  if (!handler) throw new Error("No failed handler registered")

  return handler as FailedHandler
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(async () => {
  const { stopWorker } = await import("../worker")

  await stopWorker()

  mocks.handlers.clear()
  mocks.getJobExhaustedHandler.mockReturnValue(null)
  vi.clearAllMocks()
})

test("an attempt that a retry may still recover is logged and not reported", async () => {
  const onFailed = await startAndGetFailedHandler()

  onFailed({ ...RENDER_JOB, attemptsMade: 2 }, new Error("Chromium crashed"))

  expect(mocks.reportError).not.toHaveBeenCalled()
  expect(mocks.logger.error).toHaveBeenCalledWith(
    expect.objectContaining({ action: "worker.job", attempt: 2, errorEventId: undefined }),
    "Job failed"
  )
})

test("a job that exhausts its attempts is reported by name, without its id", async () => {
  const onFailed = await startAndGetFailedHandler()
  const error = new Error("Chromium crashed")

  onFailed({ ...RENDER_JOB, attemptsMade: 5 }, error)

  expect(mocks.reportError).toHaveBeenCalledWith(error, {
    source: "job",
    jobName: "invoice.pdf.render",
    attempts: 5
  })
  expect(mocks.logger.error).toHaveBeenCalledWith(
    expect.objectContaining({
      jobId: "invoice-pdf-3f2a1b9c",
      errorEventId: "0123456789abcdef0123456789abcdef",
      err: error
    }),
    "Job failed"
  )
  expect(mocks.recordScheduledJobOutcome).toHaveBeenCalledWith(
    "invoice.pdf.render",
    "failed",
    expect.any(Number)
  )
})

test("a job that exhausts its attempts is handed to its exhausted handler with its payload", async () => {
  const onExhausted = vi.fn(async () => undefined)
  mocks.getJobExhaustedHandler.mockReturnValue(onExhausted)
  const onFailed = await startAndGetFailedHandler()

  onFailed({ ...RENDER_JOB, data: { invoiceId: "i-1" }, attemptsMade: 5 }, new Error("boom"))

  await vi.waitFor(() => expect(onExhausted).toHaveBeenCalledWith({ invoiceId: "i-1" }))
})

test("an attempt a retry may still recover never reaches the exhausted handler", async () => {
  const onExhausted = vi.fn(async () => undefined)
  mocks.getJobExhaustedHandler.mockReturnValue(onExhausted)
  const onFailed = await startAndGetFailedHandler()

  onFailed({ ...RENDER_JOB, data: { invoiceId: "i-1" }, attemptsMade: 4 }, new Error("boom"))

  expect(onExhausted).not.toHaveBeenCalled()
})

test("a failing exhausted handler is logged rather than thrown", async () => {
  const failure = new Error("database unavailable")
  mocks.getJobExhaustedHandler.mockReturnValue(vi.fn(async () => Promise.reject(failure)))
  const onFailed = await startAndGetFailedHandler()

  onFailed({ ...RENDER_JOB, data: { invoiceId: "i-1" }, attemptsMade: 5 }, new Error("boom"))

  await vi.waitFor(() =>
    expect(mocks.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ action: "worker.job.exhausted", err: failure }),
      "Exhausted job handler failed"
    )
  )
})
