import { z } from "zod"

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

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url(),
  REMIT_ENCRYPTION_KEY: encryptionKeySchema,
  MINIO_ENDPOINT: z.url(),
  MINIO_ROOT_USER: z.string().min(1),
  MINIO_ROOT_PASSWORD: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default("remit"),
  MINIO_PUBLIC_URL: z.url(),
  NEXT_PUBLIC_STORAGE_BASE_URL: z.url()
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n")

  throw new Error(`Invalid environment variables:\n${message}`)
}

export const env = parsed.data
