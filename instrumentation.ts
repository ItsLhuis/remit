export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // Env must validate first (its import has boot-time side effects); the remaining two imports are
  // independent of each other, so load them together.
  await import("@/lib/config/env")

  // The activity module is imported for its side effect: it subscribes to the domain events that
  // belong in the user-facing feed at module load, the way `scripts/worker.ts` imports the feature
  // job modules. Nothing under `lib/` may import a feature, so this hook is the server runtime's
  // only place to wire a bus subscriber. `lib/events/bus.ts` holds its registry on `globalThis`
  // precisely because this file is compiled into its own bundle.
  const [{ logger }, { ensureBucket }] = await Promise.all([
    import("@/lib/logger"),
    import("@/lib/storage/s3"),
    import("@/features/activityLog/events")
  ])

  try {
    await ensureBucket()
  } catch (error) {
    logger.error(
      { action: "instrumentation.register", service: "s3", err: error },
      "Failed to ensure bucket exists"
    )
  }
}
