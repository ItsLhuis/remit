# DR-0045 — Shared rate limiting and the cache decision

- **Status:** Shipped
- **Date:** 2026-09-10
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0023, ADR-0037
- **Supersedes:** —

## What

Every rate limit in the application counts in Redis, so a limit holds across processes and survives
a restart, and the application cache ADR-0023 promised is deferred on measurements rather than built
without a caller.

## Why

ADR-0023 justified adding Redis on two uses — the job queue and an application cache layer recorded
in its own ADR — and named it as the rate-limiter backend for multi-instance deployments. Neither
second use existed. `lib/rateLimit/` shipped one adapter, process-local and chosen at import time,
so every limit reset when the app restarted and an operator running two app replicas gave each its
own allowance. The cache ADR was never written.

## Scope

Included: a Redis-backed `RateLimitAdapter` behind the existing contract, the explicit selection of
it, its behaviour when Redis is unreachable at each call site, tests against a real Redis, a
measurement of the dashboard and reports reads, the ADR ADR-0023 promised, and the documentation
that describes the result.

Excluded, with reasons:

- **An application cache.** No read has a measured need for one; ADR-0037 records the timings and
  the bar a future cache must clear.
- **Better Auth's own limiter.** It is configured in `lib/auth/index.ts`, counts inside the app
  process, and does not go through `lib/rateLimit/`.
- **A variable to choose the adapter.** `REDIS_URL` is boot-fatal, so there is no deployment without
  Redis for a switch to serve.

## How

The limit is a fixed window counted by one Lua script that increments the key, sets its expiry only
when that increment opened the window, and returns the count with the remaining TTL. Redis runs a
script atomically, which is the whole of the concurrency property: a read-then-write pair lets two
requests both see a count under the limit. `resetAt` comes from the returned TTL, because the window
opened at a request another process may have served.

The limiter has its own ioredis connection. The queue's factory waits out an outage forever, which
on a request path would hold every public request open; this one abandons a command after 500 ms and
flushes what queued during a disconnect after one failed reconnect. The connection and the
environment it reads are both loaded on first use, so importing the limiter — which `proxy.ts` and
its tests do — neither connects nor validates the deployment environment.

While Redis is unreachable every call site counts in a per-process in-memory adapter, which is what
the limiter was before. ADR-0037 weighs failing open and failing closed at each of the nine call
sites; no site argued for either. The outage is logged when it starts and when it ends, not per
request.

A Next.js 16 proxy always runs on the Node.js runtime, so `proxy.ts` uses the same Redis-backed
limiter as the route handlers. It is compiled as its own bundle, so it holds its own limiter
instance and its own connection.

The cache was decided by measurement. Nothing in the application caches the dashboard or reports
reads — no module uses `unstable_cache` or `"use cache"`, and both pages render per request — so a
Redis cache would have been the only value cache in the product, with an invalidation trigger needed
on every write that moves money. On a realistic dataset every read took single-digit milliseconds.

## Evidence

- Adapter: `lib/rateLimit/redisAdapter.ts` (`createRedisAdapter`, the window script, the fallback
  and its transition logging).
- Pure window arithmetic: `lib/rateLimit/window.ts` (`toRateLimitKey`, `parseWindowReply`,
  `toRateLimitResult`).
- Connection: `lib/rateLimit/connection.ts` (`createRateLimitConnection`, the lazy
  `getRateLimitConnection`).
- Selection: `lib/rateLimit/index.ts` (`rateLimitInstance`); `lib/rateLimit/inMemoryAdapter.ts`'s
  comment now describes its role as fallback and test double.
- Tests: `lib/rateLimit/__tests__/window.test.ts` (11 cases), `redisAdapter.test.ts` (7 cases,
  including the lazy connection of the exported instance), `redisAdapter.integration.test.ts` (5
  cases against a real Redis: 50 concurrent requests against a limit of 10, a restart, window expiry
  and reopening, and an unreachable server).
- `lib/metrics/__tests__/handleMetricsRequest.test.ts` now substitutes the in-memory adapter for
  `rateLimitInstance`.
- Documents: `docs/architecture/ARCHITECTURE.md` section 9 (the rate-limiting passage) and section
  20 (the ADR row); [ADR-0037](../architecture/adr/0037-shared-rate-limiting-and-cache-deferral.md)
  and its row in `docs/architecture/adr/README.md`; `.env.example`'s `REDIS_URL` comment.
- No Compose change: `docker-compose.test.yml` already carries `redis_test`, CI waits for it before
  `pnpm test:integration`, and `vitest.integration.config.ts` points the suite at database 1.

## Verification

`pnpm typecheck` passes. `pnpm lint` reports no errors; its two warnings are `max-lines` in
`features/templates` files this change does not touch. `pnpm test` passes all 2,264 tests in 251
files. `pnpm test:integration` passes all 803 tests in 83 files. One earlier run on the same code
failed two ten-second hook timeouts — `lib/jobs/__tests__/queueRoundTrip.integration.test.ts`'s
worker start-up and the shared truncating `beforeEach` in `tests/integration/setup.ts`, neither
reached by this change — and both files passed on their own and in the full rerun. `pnpm build`
succeeds, and no chunk under `.next/static` contains the limiter while the server chunks do.
react-doctor and fallow report nothing on any file this change touched; both fail repository-wide on
their existing backlogs.

Two existing tests broke and were dealt with differently. `tests/applySecurityHeaders.test.ts`
imports `proxy.ts`, and the connection's static import of `lib/config/env.ts` made that import exit
the process on an invalid environment; the fix was in the code, loading the environment on first
use, and the test is unchanged. `handleMetricsRequest.test.ts` relied on the real
`rateLimitInstance` for its thirty-first-request case while mocking the environment without a Redis
URL; with the limiter now reaching for Redis, it hung under the test's fake timers. The behaviour it
asserts is unchanged, and it now asserts it against the in-memory test double, which is what that
adapter is kept for. The OTP, signing, checkout, portal, webhook and proxy route tests all mock
`@/lib/rateLimit` and pass untouched.

The reads were timed against the test database, fifteen runs after three warm-ups:

| Dataset                                                    | Dashboard, per period | Reports, per report | Slowest p95 |
| ---------------------------------------------------------- | --------------------- | ------------------- | ----------- |
| `--size large`: 24 clients, 24 invoices                    | 3.9–7.1 ms median     | 2.7–4.5 ms median   | 15 ms       |
| Seeder maximum: 1,000 clients, 20,000 invoices, 6,666 paid | 145–151 ms median     | 32–260 ms median    | 333 ms      |

Manually, against a production build with the development stack:

- Six OTP requests from one address answered 400 five times — the token was not real, and the limit
  is consumed first — then 429. `remit:ratelimit:proposal.otp.request:<ip>` held the count with a
  TTL under fifteen minutes, beside the proxy's sixty-second backstop key.
- After the server was killed and restarted, the next request from that address was refused at once,
  and the key's TTL had kept counting down rather than resetting.
- With the Redis container stopped, a fresh address was answered 400 five times and then 429 by the
  per-process fallback, each request taking up to about a second, and the log carried one
  `Rate limiter store unavailable` line from the proxy's instance and one from the routes'.
- With Redis started again, the first request still fell back because the client had not yet
  reconnected; within a few seconds requests were counted in Redis again and each instance logged
  `Rate limiter store recovered` once.

## Known gaps

- **Better Auth's sign-in, sign-up and password-reset limits still count in the app process**, so
  they reset on restart and multiply with replicas.
- **During a Redis outage a public request can take about a second**, because the proxy and the
  route each wait up to the 500 ms command timeout before falling back.
- **The proxy and the route handlers hold separate limiter instances and connections**, so an outage
  is logged once by each and their fallback counters are separate.
- **A fixed window allows up to twice a limit across a window boundary**, as the in-memory adapter
  did.
- **A counter can over-count after an outage**, when a command that timed out still reaches Redis on
  reconnect.
- **The two tax reports take about a quarter of a second at the seeder's maximum volume.** Their
  query shape, not a cache, is where to look if that volume becomes real.
- **Locally, the integration suite counts in whatever Redis answers on `localhost:6379`**, database
  1, which on a development machine is the development stack's own container.
