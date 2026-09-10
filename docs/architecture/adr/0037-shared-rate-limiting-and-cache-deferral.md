# ADR-0037: Rate limits count in Redis, fall back per process, and no application cache is built yet

- **Status:** Accepted
- **Date:** 2026-09-10

## Context

[ADR-0023](0023-job-scheduling-bullmq-redis.md) added Redis on the strength of two uses: the job
queue and "a planned application cache layer", which it said would be recorded in its own ADR. Its
Positive consequences also named Redis as "the rate-limiter backend for multi-instance deploys".
Neither second use was built. `lib/rateLimit/` shipped one adapter, a process-local map chosen at
import time, so every limit reset when the app restarted and an operator running two app replicas
behind a proxy gave each replica its own allowance. This ADR is the one ADR-0023 promised. It
refines ADR-0023 and replaces nothing in it.

Four facts shaped the decision:

- **Redis is always there.** `REDIS_URL` is boot-fatal in `lib/config/env.ts`, so no Remit instance
  runs without one. What can happen is an outage at runtime.
- **The proxy can load a Redis client.** `proxy.ts` is the largest call site. In Next.js 16 a proxy
  always runs on the Node.js runtime and a runtime segment config there is a build error, so it can
  import ioredis like any route handler — as it already imports the database driver.
- **The queue's connection options are wrong for a request path.** `lib/jobs/connection.ts` sets
  `maxRetriesPerRequest: null` so BullMQ's blocking commands wait out any outage. A rate-limit check
  with that setting would hold every public request open for as long as Redis is down.
- **Nothing caches the heaviest reads today.** No module uses `unstable_cache` or `"use cache"`, and
  the dashboard and reports pages read `searchParams`, so they render per request and the
  `revalidatePath` calls in every mutation refresh a route rather than a stored value. A Redis cache
  would be the only value cache in the product, not a second layer under one.

The dashboard and reports reads were timed against the test database seeded by `remit:seed-demo`,
fifteen runs each after three warm-up runs, on a development machine with PostgreSQL in Docker:

| Dataset                                                                                       | Dashboard, per period | Reports, per report | Slowest p95 |
| --------------------------------------------------------------------------------------------- | --------------------- | ------------------- | ----------- |
| `--size large`: 24 clients, 44 projects, 24 invoices, 88 time entries                         | 3.9–7.1 ms median     | 2.7–4.5 ms median   | 15 ms       |
| Seeder maximum: 1,000 clients, 4,000 projects, 20,000 invoices, 6,666 payments, 8,000 entries | 145–151 ms median     | 32–260 ms median    | 333 ms      |

The slowest reads at the maximum are the two tax reports, which aggregate every issued line item and
credit note line in the range.

## Decision

**A rate limit is a fixed window counted in Redis by one script.** The script increments the key,
sets its expiry only when that increment opened the window, and returns the count with the remaining
TTL (`lib/rateLimit/redisAdapter.ts`). Redis runs a script atomically, so concurrent requests cannot
both read a count below the limit, and no key can be left incremented without an expiry. A result's
`resetAt` is derived from the remaining TTL, because the window opened at a request that another
process may have served. Keys live under `remit:ratelimit:` in the queue's database. The
`RateLimitAdapter` contract did not change.

**The limiter has its own connection, built to fail fast** (`lib/rateLimit/connection.ts`): a 500 ms
command timeout, one retry per command across a reconnect, a 2 s connect timeout, and a socket
opened on first use rather than at import, so `next build` never connects.

**Redis is selected unconditionally, with no variable to turn it off.** The in-memory adapter
remains as the fallback and as the test double.

**While Redis is unreachable, every call site counts per process instead.** That is what the limiter
was before this ADR: no call site loses its limit, and none refuses a request because the store is
down. The outage is logged when it starts and when it ends, not per request. Failing open and
failing closed were weighed at each call site:

| Call site                                  | Failing open would                                                                          | Failing closed would                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `proxy.ts`, public token routes (60 / min) | drop the backstop in front of every public route while the instance is already degraded     | take every shared invoice, proposal, contract and portal link offline         |
| `proxy.ts`, `/invite/[invitationId]` (30)  | drop the limit on the only anonymous page that renders a sign-up form                       | stop an invited member joining                                                |
| Proposal OTP request (5 / 15 min)          | let one token be used to pump one-time-code mail through the operator's provider            | stop every client accepting a proposal                                        |
| Proposal OTP verify                        | leave only the five-attempt ceiling per code standing between a caller and a six-digit code | stop every client accepting a proposal                                        |
| Contract signing (5 / 15 min)              | reopen the probing of which contracts are still signable                                    | stop every client signing                                                     |
| `POST /i/[token]/pay` (5 / 15 min)         | let a caller spend Stripe API calls against the operator's account                          | stop clients paying                                                           |
| `/s/[token]` portal (30 / 5 min)           | lift the tighter bound on the highest-value token in the instance                           | show every client the unavailable panel                                       |
| `/api/webhooks/stripe` (120 / min)         | lift the cap on what an anonymous caller can make the instance decrypt and verify           | refuse Stripe's deliveries, which stops payments being recorded until retried |
| `/api/metrics` (30 / min)                  | lift the limit on guessing the metrics token                                                | hide metrics during the outage an operator would be scraping them to see      |

No row argues for either extreme, and a per-process counter answers every one of them.

**No application cache is built.** On a freelancer's data every dashboard and report read finishes
in single-digit milliseconds. At the seeder's maximum — twenty thousand invoices, a freelancer
issuing ten a week for forty years — the slowest is a third of a second, on a page an owner opens a
few times a day. A cache would buy nothing measurable on the first and would be the wrong fix for
the second, where the tax aggregation's query shape is the place to look. It would also bring the
whole invalidation problem with it: every write that moves money, a payment, a credit note, a late
fee, a restored record, would need a named trigger, where today there is nothing to go stale.

If a cache is ever built, it serves a caller that has been measured, and it follows these rules:
values sit under their own key namespace and every entry has a TTL and a named invalidation trigger;
a miss or an unreachable Redis falls through to the query; nothing encrypted, nothing from
`clients.notes`, and no bearer token is ever stored; and a value computed for one role is keyed by
that role.

**Redis now holds three things**: the BullMQ queue (ADR-0023), the scheduled-job statistics hash
(`lib/jobs/stats.ts`, [ADR-0036](0036-metrics-allowlist-and-collection.md)), and the rate-limit
counters. Losing the counters costs nothing but an early reset of every window. A fourth use starts
by choosing its connection options — blocking or fail-fast — and its key namespace, and by stating
what losing its data would cost.

## Consequences

### Positive

- A limit holds across the app process and every replica, and a restart no longer resets it.
- A Redis outage degrades rate limiting to what it was before, rather than switching it off or
  taking the public surfaces down with it.
- No dependency was added; the adapter is one short script behind the existing contract, and every
  call site and its tests are unchanged.
- ADR-0023's promise is kept, and the cache it anticipated has a written bar to clear.

### Negative

- Each limited request costs one Redis round trip.
- A fixed window lets a caller spend up to twice the limit across a window boundary. The in-memory
  adapter behaved the same way, and every limit here is coarse enough for that to be acceptable.
- During an outage each replica has its own allowance and a restart resets it, and a command that
  timed out can still reach Redis when the connection returns, so a counter may briefly over-count.
- Better Auth's limits on sign-in, sign-up and password reset still count inside the app process.
  They are configured in `lib/auth/index.ts` and do not pass through `lib/rateLimit/`.

## Alternatives considered

### Keep the in-memory adapter only

Correct for one process that never restarts. Rejected because a restart resets every limit — the OTP
and signing limits included — and an operator running a second replica doubles each allowance
without being told.

### Count in PostgreSQL

An upsert per limited request would work without Redis, but it puts a write on the primary database
in front of every public request, and the table would churn constantly. Redis is already provisioned
for exactly this.

### Use a rate-limiting library

`rate-limiter-flexible` is mature and uses the same atomic-script approach. Rejected because the
whole algorithm here is a five-line script behind an existing interface, and the library's own
insurance and in-memory-block features duplicate the fallback this ADR chooses.

### A sliding window or a token bucket

Either smooths the boundary burst a fixed window allows. Rejected because every call site's limit
and its tests were written against fixed-window semantics, and none of them is precise enough for
the difference to matter.

### Fail open, or fail closed, everywhere

Rejected per call site in the table above.

### Cache at the ORM layer, or through a caching library

Rejected for the reason the cache was deferred: no read has a measured need, and a cache below the
queries would hide staleness from every read path at once.
