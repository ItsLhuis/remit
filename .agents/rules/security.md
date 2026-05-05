---
paths:
  - "features/auth/**"
  - "features/settings/**"
  - "lib/auth*.ts"
  - "app/api/**"
  - "app/(public)/**"
  - "proxy.ts"
---

# Security Rules

## Secrets and credentials

Secrets are never logged, never returned in responses, never embedded in toast messages, and never
present in test fixtures committed to the repository. Use the env validator in `lib/env.ts` for
required secrets and document each one in `.env.example`.

## Encrypted fields

Fields designated encrypted in `docs/architecture/ARCHITECTURE.md` (Security Architecture -
Encryption at rest) (`settings.smtpPass`, `settings.resendApiKey`, `settings.stripeSecretKey`,
`settings.stripeWebhookSecret`, `settings.paymentIban`, `clients.notes`) are defined in the Drizzle
schema using the `encryptedColumn()` helper from `database/schema/helpers.ts`. They are never
defined as raw `text()` columns.

## Public token generation and comparison

Public tokens (used on `/i/[token]`, `/p/[token]`, and future `/c/[token]`, `/s/[token]` routes) are
generated with a cryptographically secure RNG:

```ts
// ✓ - cryptographically secure, URL-safe token
import { randomBytes } from "crypto"

const token = randomBytes(32).toString("base64url")

// ✗ - Math.random() is not cryptographically secure
const token = Math.random().toString(36).slice(2)
```

Token comparison uses constant-time equality to prevent timing attacks. A token miss returns the
same response shape and timing as a "valid token, document archived" case to defeat enumeration:

```ts
// ✓ - constant-time comparison
import { timingSafeEqual } from "crypto"

const tokenBuffer = Buffer.from(incomingToken)
const storedBuffer = Buffer.from(storedToken)
const isMatch =
  tokenBuffer.length === storedBuffer.length && timingSafeEqual(tokenBuffer, storedBuffer)

// ✗ - string equality leaks timing information
const isMatch = incomingToken === storedToken
```

## Public route indexing

Public token routes always set `X-Robots-Tag: noindex, nofollow` on the HTTP response and include
`<meta name="robots" content="noindex,nofollow">` in the page head.

## Audit logging

Auth-sensitive flows write an audit log entry to `audit_log` before returning. Covered flows: login
success and failure, password change, TOTP setup and reconfiguration, recovery code generation and
consumption, settings changes touching SMTP / Stripe / payment information, data exports, entity
deletions, and public token rotations.

Required fields per entry: `actorUserId` (or `null` for pre-auth events), `targetEntityType`,
`targetEntityId`, `metadata` (JSONB with relevant context), `ipAddress`, `userAgent`. The
`audit_log` table is insert-only - no UPDATE or DELETE operations ever exist for it.

## Rate limiting

Every endpoint that handles authentication or processes a public token declares its rate limit at
the top of the route module via the rate limiter helper. No such endpoint ships without a rate
limit. Limits apply to: `POST /login`, `POST /register`, `/i/[token]`, `/p/[token]`, password reset
requests, and recovery code redemption.

## Cookie settings

Cookies set anywhere in the codebase use `httpOnly: true`, `secure: true` in production, and
`sameSite: "lax"` for session cookies.

## Proxy and routing state

The proxy logic in `proxy.ts` derives authentication and onboarding state exclusively from the
database and the session. Routing state is never stored in cookies. Adding a cookie to control which
route a user is directed to is a violation of this rule - extend the DB-derived state machine
instead. See `docs/architecture/ARCHITECTURE.md` (Security Architecture - Routing state rule) for
the authoritative state machine.
