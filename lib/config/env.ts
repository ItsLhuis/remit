import { z } from "zod"

import { logger } from "@/lib/logger"

const encryptionKeySchema = z
  .string()
  .trim()
  .refine((value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0, {
    message: "Must be a base64-encoded 32-byte key"
  })
  .refine((value) => {
    const key = Buffer.from(value, "base64")

    return key.length === 32 && key.toString("base64") === value
  }, "Must be a base64-encoded 32-byte key")

const optionalEnvString = <TSchema extends z.ZodType>(schema: TSchema) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value

    const trimmed = value.trim()

    return trimmed.length > 0 ? trimmed : undefined
  }, schema.optional())

const schema = z.object({
  DATABASE_URL: z.string().min(1),
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
  REMIT_METRICS_TOKEN: optionalEnvString(z.string().min(1))
})

const isBuildEnvValidationSkipped =
  process.env.REMIT_BUILD_ENV_VALIDATION === "skip" && process.env.npm_lifecycle_event === "build"

const parsed = isBuildEnvValidationSkipped
  ? schema.safeParse({
      ...process.env,
      DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      BETTER_AUTH_SECRET: "build-time-placeholder-secret",
      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      REMIT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      MINIO_ENDPOINT: "http://localhost:9000",
      MINIO_ROOT_USER: "build-time-placeholder-user",
      MINIO_ROOT_PASSWORD: "build-time-placeholder-password",
      MINIO_BUCKET: "remit",
      MINIO_PUBLIC_URL: process.env.NEXT_PUBLIC_STORAGE_BASE_URL || "http://localhost:9000/remit",
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
