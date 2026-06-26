export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // Env must validate first (its import has boot-time side effects); the remaining two imports are
  // independent of each other, so load them together.
  await import("@/lib/config/env")

  const [{ logger }, { ensureBucket }] = await Promise.all([
    import("@/lib/logger"),
    import("@/lib/storage/s3")
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
