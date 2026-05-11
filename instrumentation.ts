export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  await import("@/lib/config/env")

  const { logger } = await import("@/lib/logger")

  const { ensureBucket } = await import("@/lib/storage/s3")

  try {
    await ensureBucket()
  } catch (error) {
    logger.error(
      { action: "instrumentation.register", service: "s3", err: error },
      "Failed to ensure bucket exists"
    )
  }
}
