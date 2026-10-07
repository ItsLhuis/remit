const CRASH_FLUSH_TIMEOUT_MS = 3_000

// Longer than the flush, so it only fires when something before the flush hangs — loading the
// reporter or writing the log line — and the exit below never comes.
const CRASH_EXIT_DEADLINE_MS = 5_000

// A worker that throws outside any job after it has started is the same failure as one that fails
// to start (ADR-0041's process boundary): nobody is watching, the container log is the only other
// trace, and without this Node's default for an unhandled rejection kills the process with nothing
// reported at all. It reports, logs with the event id, and exits non-zero, because after an uncaught
// exception the process's state is unknown and a restart is the only safe continuation — the Compose
// service's `restart: unless-stopped` brings a fresh worker up, and BullMQ hands the job it held, if
// any, to that worker once its lock lapses.
export function exitOnWorkerCrash(): void {
  let isCrashing = false

  const onCrash = (error: unknown) => {
    // A second failure while the first is being reported must not report or exit twice; the first
    // exit is already on its way.
    if (isCrashing) return

    isCrashing = true

    // Not unref'd: if everything else has closed, this timer is what keeps the process alive long
    // enough to exit non-zero rather than drain to a clean exit code.
    setTimeout(() => process.exit(1), CRASH_EXIT_DEADLINE_MS)

    void reportWorkerCrash(error)
      .catch((reportFailure: unknown) => {
        console.error("[worker] Crash report failed:", reportFailure)
      })
      .finally(() => process.exit(1))
  }

  process.on("unhandledRejection", onCrash)
  process.on("uncaughtException", onCrash)
}

export async function reportWorkerCrash(error: unknown): Promise<void> {
  const [{ flushErrorReports, reportError }, { logger }] = await Promise.all([
    import("@/lib/errorTracking"),
    import("@/lib/logger")
  ])

  const errorEventId = reportError(error, { source: "process", phase: "run" })

  logger.error(
    { action: "worker.crash", errorEventId: errorEventId ?? undefined, err: error },
    "Worker crashed"
  )

  await flushErrorReports(CRASH_FLUSH_TIMEOUT_MS)
}
