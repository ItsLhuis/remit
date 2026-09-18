import pkg from "@/package.json"

import { loadCliEnvironment } from "./core/cli/bootstrap"
import { loadWorkerFeatureModules } from "./core/worker/loadWorkerFeatureModules"

const START_FAILURE_FLUSH_TIMEOUT_MS = 3_000

// The background job consumer (ADR-0023). Not a `remit:*` command: the CLI contract covers
// operator-invoked commands that exit 0 or 1, and this process exits only on a signal. It is
// packaged the same way `scripts/migrate.ts` is — a tsup entry copied into the runtime image and
// started by its own Compose service — and carries the same "not a package script" limitation.
async function main(): Promise<void> {
  loadCliEnvironment()

  // Error tracking starts from the validated `env`, for the reason `instrumentation.ts` gives: a
  // failed validation exits inside this import, before a sender exists to transmit it. It starts
  // ahead of the feature modules so a failure while loading them is reported as a failed start.
  const { env } = await import("@/lib/config/env")

  if (env.SENTRY_DSN) {
    const { startErrorTracking } = await import("@/lib/errorTracking")

    startErrorTracking({
      dsn: env.SENTRY_DSN,
      runtime: "worker",
      release: pkg.version,
      environment: env.NODE_ENV
    })
  }

  const [{ startWorker, stopWorker }] = await Promise.all([
    import("@/lib/jobs/worker"),
    loadWorkerFeatureModules()
  ])

  // Registered before the worker starts so a signal arriving during startup still unwinds cleanly.
  // `stopWorker` waits for in-flight jobs rather than interrupting them, which is what keeps a
  // deploy from tearing down a half-written generation.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      void shutdown(stopWorker)
    })
  }

  await startWorker()
}

async function shutdown(stopWorker: () => Promise<void>): Promise<void> {
  try {
    await stopWorker()

    const { client } = await import("@/database")

    await client.end()

    process.exit(0)
  } catch (error) {
    console.error("[worker] Shutdown failed:", error)
    process.exit(1)
  }
}

try {
  await main()
} catch (error) {
  await reportStartFailure(error)
  process.exit(1)
}

// Nothing is reported when tracking never started, which includes a start that failed on its
// environment. The flush is bounded so an unreachable receiver cannot keep a dead worker alive.
async function reportStartFailure(error: unknown): Promise<void> {
  const { flushErrorReports, reportError } = await import("@/lib/errorTracking")

  const errorEventId = reportError(error, { source: "process", phase: "start" })

  console.error("[worker] Failed to start:", { errorEventId: errorEventId ?? undefined }, error)

  await flushErrorReports(START_FAILURE_FLUSH_TIMEOUT_MS)
}
