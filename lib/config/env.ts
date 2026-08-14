import { z } from "zod"

import { logger } from "@/lib/logger"

const encryptionKeySchema = z
  .string()
  .trim()
  .refine((value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0, {
    message: "Must be a base64-encoded 32-byte key"
  })
  // The round-trip comparison is the point of the second refine: `Buffer.from` accepts malformed
  // base64 by silently discarding the bad trailing characters, so a mistyped key can still decode
  // to 32 bytes and boot a server that can no longer read anything encrypted with the real key.
  .refine((value) => {
    const key = Buffer.from(value, "base64")

    return key.length === 32 && key.toString("base64") === value
  }, "Must be a base64-encoded 32-byte key")

// `z.url()` would accept any absolute URL, including the `http://` an operator reaches for by
// reflex. ioredis silently treats an unknown protocol as a hostname, so the failure would surface as
// a connection timeout inside the worker rather than at boot, which is the opposite of what this
// file exists for.
const redisUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      return ["redis:", "rediss:"].includes(new URL(value).protocol)
    } catch {
      return false
    }
  }, "Must be a redis:// or rediss:// connection string")

const optionalEnvString = <TSchema extends z.ZodType>(schema: TSchema) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value

    const trimmed = value.trim()

    return trimmed.length > 0 ? trimmed : undefined
  }, schema.optional())

// Every field without `optionalEnvString` is boot-fatal: the process exits below rather than
// starting degraded, because a missing database URL, auth secret, encryption key or object-store
// credential makes the instance unable to serve or to decrypt its own data, and failing at boot is
// far cheaper than failing per request. `REDIS_URL` is boot-fatal for the same reason even though
// only the worker consumes it: server actions enqueue jobs, and an instance that cannot reach its
// queue silently stops generating recurring invoices and sending reminders (ADR-0023).
// `SENTRY_DSN`, `REMIT_METRICS_TOKEN` and `REMIT_CHROMIUM_PATH` are the
// optional ones, since their features simply stay off when unset.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: redisUrlSchema,
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  REMIT_ENCRYPTION_KEY: encryptionKeySchema,
  REMIT_HOSTED_MODE: z
    .string()
    .default("false")
    .transform((value) => value === "true" || value === "1"),
  REMIT_DATA_DIR: z.string().min(1).default("data"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MINIO_ENDPOINT: z.url(),
  MINIO_ROOT_USER: z.string().min(1),
  MINIO_ROOT_PASSWORD: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default("remit"),
  MINIO_PUBLIC_URL: z.url(),
  NEXT_PUBLIC_STORAGE_BASE_URL: z.url(),
  SENTRY_DSN: optionalEnvString(z.url()),
  REMIT_METRICS_TOKEN: optionalEnvString(z.string().min(1)),
  // Optional rather than boot-fatal because only the worker image ships Chromium (ADR-0022): the web
  // application never launches a browser, and making this mandatory would stop it starting over a
  // binary it does not use. `lib/pdf/renderPdf.ts` fails on the render path when it is missing.
  REMIT_CHROMIUM_PATH: optionalEnvString(z.string().min(1))
})

// The placeholders below exist so `next build` can run in an image build with no real secrets
// available. They are gated on both an explicit opt-in and the build lifecycle event so they can
// never be reached by a running server: the placeholder encryption key is all zero bytes, and an
// instance booting with it would write data nobody can recover. Nothing here may be relaxed into a
// runtime fallback.
const isBuildEnvValidationSkipped =
  process.env.REMIT_BUILD_ENV_VALIDATION === "skip" && process.env.npm_lifecycle_event === "build"

const parsed = isBuildEnvValidationSkipped
  ? schema.safeParse({
      ...process.env,
      DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      REDIS_URL: "redis://localhost:6379",
      BETTER_AUTH_SECRET: "build-time-placeholder-secret",
      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      REMIT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      MINIO_ENDPOINT: "http://localhost:9000",
      MINIO_ROOT_USER: "build-time-placeholder-user",
      MINIO_ROOT_PASSWORD: "build-time-placeholder-password",
      MINIO_BUCKET: "remit",
      MINIO_PUBLIC_URL: "http://localhost:9000",
      NEXT_PUBLIC_STORAGE_BASE_URL:
        process.env.NEXT_PUBLIC_STORAGE_BASE_URL || "http://localhost:9000/remit"
    })
  : schema.safeParse(process.env)

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
