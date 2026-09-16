import { logger } from "@/lib/logger"

import { envSchema } from "./envSchema"

// The placeholders below exist so `next build` can run in an image build with no real secrets
// available. They are gated on both an explicit opt-in and the build lifecycle event so they can
// never be reached by a running server: the placeholder encryption key is all zero bytes, and an
// instance booting with it would write data nobody can recover. Nothing here may be relaxed into a
// runtime fallback.
const isBuildEnvValidationSkipped =
  process.env.REMIT_BUILD_ENV_VALIDATION === "skip" && process.env.npm_lifecycle_event === "build"

const parsed = isBuildEnvValidationSkipped
  ? envSchema.safeParse({
      ...process.env,
      DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      REDIS_URL: "redis://localhost:6379",
      BETTER_AUTH_SECRET: "build-time-placeholder-secret",
      REMIT_PUBLIC_URL: "http://localhost:3000",
      REMIT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      MINIO_ENDPOINT: "http://localhost:9000",
      MINIO_ROOT_USER: "build-time-placeholder-user",
      MINIO_ROOT_PASSWORD: "build-time-placeholder-password",
      MINIO_BUCKET: "remit"
    })
  : envSchema.safeParse(process.env)

if (!parsed.success) {
  logger.fatal(
    {
      action: "env.validate",
      issues: parsed.error.issues.map((issue) => ({
        name: issue.path.join("."),
        message: issue.message
      }))
    },
    "Invalid environment variables"
  )
  process.exit(1)
}

export const env = parsed.data
