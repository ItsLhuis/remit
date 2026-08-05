import { loadCliEnvironment } from "./core/cli/bootstrap"

// The background job consumer (ADR-0023). Not a `remit:*` command: the CLI contract covers
// operator-invoked commands that exit 0 or 1, and this process exits only on a signal. It is
// packaged the same way `scripts/migrate.ts` is — a tsup entry copied into the runtime image and
// started by its own Compose service — and carries the same "not a package script" limitation.
//
// The feature job modules are imported for their side effect: each registers its handlers with
// `lib/jobs/registry` at module load, the way `features/*/events.ts` register bus subscribers.
// Without these two imports the worker starts with an empty registry and every sweep fails.
async function main(): Promise<void> {
  loadCliEnvironment()

  const [{ startWorker, stopWorker }] = await Promise.all([
    import("@/lib/jobs/worker"),
    import("@/features/invoices/jobs"),
    import("@/features/recurringInvoices/jobs")
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
  console.error("[worker] Failed to start:", error)
  process.exit(1)
}
