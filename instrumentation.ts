export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  await import("@/lib/env")

  const { ensureBucket } = await import("@/lib/s3")

  try {
    await ensureBucket()
  } catch (error) {
    console.error("[s3] Failed to ensure bucket exists:", error)
  }
}
