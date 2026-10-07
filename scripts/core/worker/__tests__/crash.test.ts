import { afterEach, beforeEach, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  flushErrorReports: vi.fn(async () => undefined),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  reportError: vi.fn(() => "0123456789abcdef0123456789abcdef")
}))

vi.mock("@/lib/errorTracking", () => ({
  flushErrorReports: mocks.flushErrorReports,
  reportError: mocks.reportError
}))

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }))

type CrashListener = (error: unknown) => void

let listeners: Map<string, CrashListener>
let exit: ReturnType<typeof vi.spyOn>

// Fake timers so the crash path's exit deadline never fires for real once `process.exit` is restored.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout"] })

  listeners = new Map()

  vi.spyOn(process, "on").mockImplementation(((event: string, listener: CrashListener) => {
    listeners.set(event, listener)

    return process
  }) as typeof process.on)

  exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as typeof process.exit)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

async function crashWith(event: "unhandledRejection" | "uncaughtException", error: unknown) {
  const { exitOnWorkerCrash } = await import("../crash")

  exitOnWorkerCrash()

  listeners.get(event)?.(error)

  await vi.waitFor(() => expect(exit).toHaveBeenCalled())
}

test.each(["unhandledRejection", "uncaughtException"] as const)(
  "reports a %s as a running-process failure, logs its event id and exits non-zero",
  async (event) => {
    const error = new Error("redis connection reset")

    await crashWith(event, error)

    expect(mocks.reportError).toHaveBeenCalledWith(error, { source: "process", phase: "run" })
    expect(mocks.logger.error).toHaveBeenCalledWith(
      { action: "worker.crash", errorEventId: "0123456789abcdef0123456789abcdef", err: error },
      "Worker crashed"
    )
    expect(mocks.flushErrorReports).toHaveBeenCalledWith(3_000)
    expect(exit).toHaveBeenCalledWith(1)
  }
)

test("a second failure during the first report neither reports nor exits again", async () => {
  await crashWith("unhandledRejection", new Error("first"))

  listeners.get("uncaughtException")?.(new Error("second"))

  expect(mocks.reportError).toHaveBeenCalledTimes(1)
  expect(exit).toHaveBeenCalledTimes(1)
})

test("still exits when the report itself fails", async () => {
  mocks.flushErrorReports.mockRejectedValueOnce(new Error("receiver unreachable"))

  await crashWith("unhandledRejection", new Error("boom"))

  expect(exit).toHaveBeenCalledWith(1)
})
