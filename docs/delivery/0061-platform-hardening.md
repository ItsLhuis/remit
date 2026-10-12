# Platform hardening

- **Status:** Shipped
- **Date:** 2026-10-12
- **Verdict:** Complete
- **Decisions:** ADR-0036, ADR-0037, ADR-0038, ADR-0040, ADR-0041, ADR-0042, ADR-0050
- **Supersedes:** —

## What

The limits, refusals and protocol answers an operator relies on hold across restarts and replicas,
say what they are, and look like what they claim to be: Better Auth's limits and the anonymous
storage route count in Redis, API responses publish their quota, the installer accepts every public
URL the application boots with, the health wait can be given longer, the metrics refusal is the
framework's own answer to an unknown path, server error frames are readable, and the MCP endpoint
refuses a foreign Origin and advertises capabilities as the specification and Remit's own refusals
do.

## Why

Better Auth counted sign-in, sign-up and password-reset attempts in the app process's memory, so a
restart reset them and every replica added a full allowance, while every other limit in Remit had
counted in Redis since ADR-0037. The anonymous route that serves stored images had no limit at all.
An API client learned its limit only from a `429`. The installer refused a public URL with an
uppercase letter or an IPv6 literal that the application itself would accept once normalised, and
its health wait gave up after a fixed five minutes, which a first start on a small server can
exceed. The metrics endpoint's refusal was a JSON `404` that no unknown path returns, so it told a
caller the route was there. Error events carried frames pointing into minified server chunks, and a
class the build had minified arrived typed `Error`. The MCP endpoint refused a foreign Origin with
the SDK's legacy `-32000` code, unlike every refusal Remit writes itself, and advertised a
`tools.listChanged` capability it never serves.

## Scope

Included: Better Auth's rate-limit storage, a limit on the anonymous storage route, rate-limit
headers on the public API and in its OpenAPI document, the installer's public URL handling, a
configurable health wait, the metrics refusal, source-mapped server error frames and class names,
the MCP Origin refusal and its advertised capabilities.

Excluded, deliberately: a sliding window, idempotent increments and a faster outage fallback for the
limiter, OAuth for MCP, how MCP discovery counts against its limit, auditing refused MCP calls, and
whether stored bytes keep passing through the application — each an open owner decision. The Compose
`uploads` volume this work was once to remove had already gone with DR-0056.

## How

Better Auth keeps choosing a limit per path, but its rate-limit storage is an adapter onto
`lib/rateLimit`: its atomic `consume` calls the same Redis fixed window, under an `auth:` key
prefix, with the same per-process fallback during an outage. The custom rules keep their values; the
window is now ADR-0037's fixed window rather than Better Auth's sliding one, whose boundary
behaviour is the owner's open sliding-window decision for every limit alike.

The storage route's limit, 1,200 per address per minute, is derived from the heaviest page that
loads from it: the clients list at its largest page of a hundred client images plus the sidebar
avatar. The anonymous document and portal pages load nothing from it.

The API publishes only the per-token limit, as the `RateLimit-Policy` and `RateLimit` fields of
draft-ietf-httpapi-ratelimit-headers-11, with `Retry-After` on that limit's `429`. The per-address
backstop publishes nothing, because its counter is shared by every caller behind one address.

The installer now spells the public URL as `new URL()` does before judging it: scheme and host in
lowercase, and an IPv6 literal in its canonical form, computed in bash. A host whose last label is a
number must be a canonical IPv4 address, which closes a hole where `127.1` was written to `.env` and
refused at boot. The health wait takes its budget from `REMIT_HEALTH_TIMEOUT_SECONDS` or
`--timeout`, 600 seconds by default. Measured from empty volumes with one CPU and 1 GB per
container, the app was healthy 14 seconds after `docker compose up`. The wait also stopped failing
on Docker's `unhealthy`, which the Compose health check reports about 80 seconds into any start,
before the old five-minute budget mattered; it fails at once only when the container stops or
restarts.

No route serves `/api/metrics` any more. `proxy.ts` counts the limit for every request to it, and
rewrites a scrape carrying the token to `/api/metrics/scrape`. Every other request continues through
the session state machine as a request for a path with no route, which is what it now is. Two
alternatives were tried against a production build and rejected. A JSON refusal is a tell. A rewrite
of the refusal to an unserved path renders the identical page body, but Next.js marks every
rewritten response with `x-middleware-rewrite`. The proxy reads the token lazily, as the limiter's
connection does, so importing the proxy still validates no environment.

Error frames are resolved in the process at report time, against maps the image ships (ADR-0050).
Turbopack's maps name nothing, so the build step that ships them writes back the source name of each
identifier the minifier renamed, read from `sourcesContent`, and then drops `sourcesContent`. The
maps are decoded by Remit's own codec, because `node:module`'s `SourceMap` carries a decoded name
forward onto later segments that have none.

The MCP endpoint keeps the SDK's `validateOriginHeader` as the decision, so the DNS-rebinding check
is exactly as strict, and answers a refusal with Remit's own `403` shape. It declares
`tools.listChanged: false` after registering tools, because it refuses every `subscriptions/listen`
and so never sends the notification.

## Evidence

- Better Auth storage: `lib/rateLimit/betterAuthStorage.ts`, `lib/auth/index.ts`;
  `lib/rateLimit/__tests__/betterAuthStorage.test.ts`,
  `lib/auth/__tests__/rateLimit.integration.test.ts`.
- Storage route: `app/api/storage/[...key]/route.ts`;
  `app/api/storage/__tests__/storage-route.test.ts`.
- API headers: `lib/rateLimit/headers.ts`, `features/api/handleApiRequest.ts`,
  `features/api/openapi.ts`; `lib/rateLimit/__tests__/headers.test.ts`,
  `features/api/__tests__/routes.integration.test.ts`,
  `features/api/__tests__/openapi.integration.test.ts`.
- Installer and health wait: `scripts/host/install.sh`, `scripts/host/_wait-for-health.sh`;
  `scripts/host/__tests__/install.test.ts`, `scripts/host/__tests__/waitForHealth.test.ts`.
- Metrics: `lib/metrics/admission.ts`, `lib/metrics/handleMetricsRequest.ts`, `proxy.ts`,
  `app/api/metrics/scrape/route.ts`; `lib/metrics/__tests__/admission.test.ts`,
  `__tests__/proxy.test.ts`.
- Error frames: `lib/errorTracking/sourceMaps.ts`, `lib/errorTracking/sourceMapCodec.ts`,
  `lib/errorTracking/stackFrames.ts`, `lib/errorTracking/errorEvent.ts`,
  `scripts/ship-server-source-maps.ts`, `scripts/core/build/serverSourceMaps.ts`, `Dockerfile`;
  `lib/errorTracking/__tests__/sourceMaps.test.ts`,
  `lib/errorTracking/__tests__/sourceMapCodec.test.ts`,
  `scripts/core/build/__tests__/serverSourceMaps.test.ts`.
- MCP: `features/mcp/handleMcpRequest.ts`, `features/mcp/buildMcpServer.ts`;
  `features/mcp/__tests__/mcpServer.integration.test.ts`.

## Verification

Observed against a standalone production build on the test stack:

- Eleven sign-ins from one address: ten `401`, then `429`. After restarting the server, the same
  address still got `429` with `x-retry-after: 879`, and a fresh address got `401`.
- Five loads of 101 objects from one address were all served. Hammering from another address got
  1,200 answers and then `429`.
- An API call carried `ratelimit: "token";r=119;t=60` and `ratelimit-policy: "token";q=120;w=60`.
- `/api/metrics` with no token or a wrong one was compared with `/api/no-such-route`, anonymously
  and with a signed-in session. All four pairs had identical status and headers, Date aside, and
  byte-identical bodies (a `307` to `/login`, and a 15,441-byte not-found page). A scrape with the
  token returned the exposition. On a fresh Compose instance with no owner, `/api/metrics`
  redirected to `/register`, as any unknown path does there.
- With the database unreachable, a public invoice page's error reached a local envelope-capturing
  receiver, standing in for GlitchTip. The event was typed `DrizzleQueryError`, with frames
  `async getPublicInvoice @ features/invoices/publicQueries.ts:49` and
  `async findIssuedInvoiceByPublicToken @ features/invoices/publicQueries.ts:140`. The image built
  from the Dockerfile carries 760 server maps.
- The MCP Inspector listed all eight tools in both protocol eras, and both eras received a `403` for
  a foreign Origin, the legacy client showing Remit's body. Raw `initialize` and `server/discover`
  both advertised `"tools":{"listChanged":false}`.
- The installer wrote `https://remit.example.com` for `HTTPS://Remit.Example.COM` and
  `https://[2001:db8::1]:8443` for `https://[2001:0DB8:0:0:0:0:0:1]:8443`, and accepted
  `http://[::1]:3000` as written.
- The client output of `pnpm build` was compared with a HEAD build made in the same directory: all
  122 chunk and media files were byte-identical.

Gates: `pnpm typecheck`; `pnpm lint` with no errors, its only two warnings the `max-lines` ones
already registered against the template editor; `pnpm test:coverage` (333 files, 2,846 tests,
thresholds met); `pnpm test:integration` (106 files, 963 tests); `pnpm vitest run tests/docs`;
`pnpm build`; `pnpm build:scripts`. fallow, judged against HEAD with the stale coverage file set
aside, attributes one finding to this change: `proxy` in `proxy.ts`, already over the complexity
thresholds at HEAD (cyclomatic 26, cognitive 31) and now 27 and 32. react-doctor reports nothing in
a changed file; its one error is the supply-chain score of `better-auth`, a dependency this change
did not touch.

Not run: a Raspberry Pi or another ARM host for the cold start, and GlitchTip or Sentry as the
receiver.

## Known gaps

None.
