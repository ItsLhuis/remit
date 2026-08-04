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
present in test fixtures committed to the repository. Use the env validator in `lib/config/env.ts`
for required secrets and document each one in `.env.example`.

Agents must not read `.env` or `.env.*` files except example/template env files such as
`.env.example` and `.env.test.example`.

## Encrypted fields

Fields designated encrypted in `docs/architecture/ARCHITECTURE.md` (Security Architecture -
Encryption at rest) (`settings.smtpPass`, `settings.resendApiKey`, `settings.stripeSecretKey`,
`settings.stripeWebhookSecret`, `settings.paymentIban`, `clients.notes`) are defined in the Drizzle
schema using the `encryptedColumn()` helper from `database/schema/helpers.ts`. They are never
defined as raw `text()` columns.

## Public token generation and comparison

Public tokens used on `/i/[token]`, `/p/[token]`, and future `/c/[token]`, `/s/[token]` routes are
generated with a cryptographically secure RNG:

```ts
// Good - cryptographically secure, URL-safe token
import { randomBytes } from "crypto"

const token = randomBytes(32).toString("base64url")

// Bad - Math.random() is not cryptographically secure
const token = Math.random().toString(36).slice(2)
```

Token comparison uses constant-time equality to prevent timing attacks. A token miss returns the
same response shape and timing as a "valid token, document archived" case to defeat enumeration:

```ts
// Good - constant-time comparison
import { timingSafeEqual } from "crypto"

const tokenBuffer = Buffer.from(incomingToken)
const storedBuffer = Buffer.from(storedToken)
const isMatch =
  tokenBuffer.length === storedBuffer.length && timingSafeEqual(tokenBuffer, storedBuffer)

// Bad - string equality leaks timing information
const isMatch = incomingToken === storedToken
```

## Public route indexing

Public token routes always set `X-Robots-Tag: noindex, nofollow` on the HTTP response and include
`<meta name="robots" content="noindex,nofollow">` in the page head.

## Audit logging

Auth-sensitive flows write an audit log entry to `audit_log` before returning. Covered flows: login
success and failure, password change, TOTP setup and reconfiguration, recovery code generation and
consumption, settings changes touching SMTP / Stripe / payment information, data exports, entity
deletions, public token rotations, and backup and restore operations written by the CLI scripts with
`actorUserId: null`.

Required fields per entry: `actorUserId` (or `null` for pre-auth events), `targetEntityType`,
`targetEntityId`, `metadata` (JSONB with relevant context), `ipAddress`, `userAgent`. The
`audit_log` table is insert-only; no UPDATE or DELETE operations ever exist for it.

Actions and routes that write audit metadata must use shared request metadata helpers. Do not parse
`x-forwarded-for` or `x-real-ip` inline.

```ts
import { getIpAddress } from "@/lib/utils"

const ipAddress = getIpAddress(requestHeaders)
const userAgent = requestHeaders.get("user-agent")
```

If IP address and user-agent extraction repeat together across several files, extract a shared
request audit metadata helper under `lib/utils/request.ts`.

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
route a user is directed to is a violation of this rule; extend the DB-derived state machine
instead. See `docs/architecture/ARCHITECTURE.md` (Security Architecture - Routing state rule) for
the authoritative state machine.

## Comments

Security code is where a reader most often "simplifies" something load-bearing. Say why a comparison
is constant-time, why a miss and a revoked token return the same shape and timing, why the rate
limit keys on what it keys on, and why a request or response is cloned before being consumed. Each
reads as redundant until it is removed. See [comments.md](comments.md) ("Where comments belong").
