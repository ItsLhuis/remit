import { z } from "zod"

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

// An origin and nothing more, compared against `URL#origin` so the check and the value can never
// disagree. Every link the instance writes — an emailed document, a Stripe return, an invitation, a
// Better Auth callback — is this value with a path appended, so a trailing slash or a path would
// produce `//i/...` or a link under a prefix Next.js does not serve. `scripts/host/install.sh` refuses
// the same shapes before it writes `.env`, and its test parses the result through this schema.
const publicUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const url = new URL(value)

      return ["http:", "https:"].includes(url.protocol) && url.origin === value
    } catch {
      return false
    }
  }, "Must be an http:// or https:// origin with no path or trailing slash, such as https://remit.example.com")

const optionalEnvString = <TSchema extends z.ZodType>(schema: TSchema) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value

    const trimmed = value.trim()

    return trimmed.length > 0 ? trimmed : undefined
  }, schema.optional())

// Separate from `lib/config/env.ts` so the shape can be imported without the parse, the logger and
// the `process.exit` that module runs at load: the installer's test validates a generated `.env`
// against exactly this object.
//
// Every field without `optionalEnvString` is boot-fatal: the process exits rather than starting
// degraded, because a missing database URL, auth secret, encryption key or object-store credential
// makes the instance unable to serve or to decrypt its own data, and failing at boot is far cheaper
// than failing per request. `REDIS_URL` is boot-fatal for the same reason even though only the
// worker consumes it: server actions enqueue jobs, and an instance that cannot reach its queue
// silently stops generating recurring invoices and sending reminders (ADR-0023). `SENTRY_DSN`,
// `REMIT_METRICS_TOKEN` and `REMIT_CHROMIUM_PATH` are the optional ones, since their features simply
// stay off when unset.
//
// No variable here is `NEXT_PUBLIC_*`, and none may become one. Next.js freezes such a value into the
// bundle at build time, so a published image would carry the address it was built with rather than
// the one it is deployed at (ADR-0040).
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: redisUrlSchema,
  BETTER_AUTH_SECRET: z.string().min(1),
  REMIT_PUBLIC_URL: publicUrlSchema,
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
  SENTRY_DSN: optionalEnvString(z.url()),
  REMIT_METRICS_TOKEN: optionalEnvString(z.string().min(1)),
  // Optional rather than boot-fatal because only the worker image ships Chromium (ADR-0022): the web
  // application never launches a browser, and making this mandatory would stop it starting over a
  // binary it does not use. `lib/pdf/renderPdf.ts` fails on the render path when it is missing.
  REMIT_CHROMIUM_PATH: optionalEnvString(z.string().min(1)),
  // Hostnames a webhook may reach at a private address or over plain HTTP, comma-separated. Owned by
  // the deployment rather than the settings surface on purpose: opening the private network to
  // outbound requests is an operator's decision, and a setting an owner could type into the UI would
  // turn the SSRF defence in `features/webhooks/services/webhookUrl.ts` into a checkbox. Unset means
  // no private receiver is reachable at all.
  REMIT_WEBHOOK_ALLOWED_HOSTS: optionalEnvString(z.string()).transform((value) =>
    (value ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  )
})
