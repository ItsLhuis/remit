# DR-0044 — Prometheus metrics endpoint

- **Status:** Shipped
- **Date:** 2026-09-10
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0018, ADR-0023, ADR-0036
- **Supersedes:** —

## What

`GET /api/metrics` serves an explicit allowlist of operational metrics in the Prometheus text format
to a scraper holding `REMIT_METRICS_TOKEN`, and is unavailable when the token is unset.

## Why

`lib/config/env.ts` validated `REMIT_METRICS_TOKEN` and `.env.example` documented it as the bearer
token protecting `GET /api/metrics`, but no route existed. An operator who set the token got a
redirect to the login page, and nothing told them why. On the Compose deployment the token never
even reached the app container, because `docker-compose.yml` passes its environment explicitly and
did not name it. ADR-0018 had already decided that metrics are local, pull-based operational data
exposed only behind that token; the decision had no implementation.

## Scope

Included: the route and its token contract; an allowlist of process, queue and scheduled-job
metrics; a collector that reads job state from Redis at scrape time and degrades per collector
rather than failing the response; the worker-side recording the scheduled-job metrics need; the
Compose passthrough for the token; and the documentation that describes all of it.

Excluded, with reasons:

- **Counts of domain rows** — invoices, clients, revenue. They are business data, and a single
  shared bearer token is not the protection ARCHITECTURE.md section 1's privacy posture asks of it.
- **Per-job-name counts outside the five scheduled sweeps.** Every other job maps onto one document
  or one email, so its count is business volume.
- **HTTP request counters by route and status.** `proxy.ts` is the only code every request passes
  through, and it sees neither the matched route pattern nor the final status code. Next.js's
  OpenTelemetry root span carries both, but consuming it turns on span creation for every request.
- **Error counters by feature and type.** `logger.error`'s `action` field is not a closed
  vocabulary, and many errors happen in the worker process the app cannot see.
- **A metrics client library, a Prometheus container, or a push path.** Zero extra infrastructure,
  and pull only (ADR-0018).

## How

The allowlist is the security property, so it is stated twice on purpose: once as the only code that
builds metric families (`collectMetrics`), and once, written out by hand, in the test that fails on
anything else. A metric added to the collector does not pass until someone argues for it in the
test.

The token check puts every refusal — no token configured, no credential, a wrong one — behind one
`404` with one body and one set of headers. A `503` for the disabled case would announce that
metrics are switched off; a `401` would confirm they are on and worth guessing at. The route's
existence is public in an open-source codebase; whether it is enabled on this instance is not. The
comparison goes through `lib/publicToken.ts`'s `matchesPublicToken`, so the bearer compare and the
public-token compare are one implementation.

The endpoint had to be added to `proxy.ts`'s `isPublicApiRoute`. Without that, an anonymous scrape
entered the session state machine and was redirected to `/login`, which a scraper reads as a
malformed body rather than as a refusal.

Job metrics travel through Redis because the app answers the scrape and the worker runs the jobs, in
different containers. The worker's `completed` and `failed` events write one hash
(`lib/jobs/stats.ts`), recording only the five repeatable sweeps and counting a failure only on the
attempt that exhausts its retries, since `failed` fires per attempt. The app reads that hash back
only through the fixed list of sweep names, so whatever else the key holds cannot reach a label.

Every Redis read is bounded at two seconds. `lib/jobs/connection.ts` sets
`maxRetriesPerRequest: null` for BullMQ's blocking commands, so during an outage a read is queued
rather than rejected and an unbounded await would hang the scrape. A collector that fails or times
out drops its own families and reports `0` on `remit_metrics_collector_up`.

The exposition format is hand-formatted by a pure function that throws on every rule a scraper
enforces: a malformed name, a counter without `_total`, a duplicate family or series.

## Evidence

- Route: `app/api/metrics/route.ts`, a thin shell over `lib/metrics/handleMetricsRequest.ts`
  (`handleMetricsRequest`: per-IP rate limit of 30 a minute, the one `404`,
  `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow` on every response).
- Proxy: `proxy.ts`'s `isPublicApiRoute` now admits `/api/metrics`.
- Token comparison: `lib/publicToken.ts` (`matchesPublicToken`), its module comment extended to name
  the second caller.
- Collection: `lib/metrics/collectMetrics.ts` (`collectMetrics`, the per-collector timeout and
  degradation). Formatter: `lib/metrics/exposition.ts` (`formatExposition`,
  `EXPOSITION_CONTENT_TYPE`).
- Job layer: `lib/jobs/stats.ts` (`QUEUE_COUNT_STATES`, `readQueueJobCounts`,
  `readScheduledJobStats`, `recordScheduledJobOutcome`, `closeStatsConnection`), exported from
  `lib/jobs/index.ts`; `lib/jobs/schedules.ts` exports `ScheduledJobName` and `SCHEDULED_JOB_NAMES`;
  `lib/jobs/worker.ts` records outcomes from its `completed` and `failed` events and closes the
  stats connection on stop.
- Translation: `errors.tooManyRequests` in `lib/i18n/types.ts` and `lib/i18n/locales/en.tsx`.
- Deployment: `docker-compose.yml` passes `REMIT_METRICS_TOKEN` to the app; `.env.example` states
  the unset and set behaviour.
- Documents: `docs/architecture/ARCHITECTURE.md` section 9 (rate-limit row), section 12 (route row),
  section 13 (configuration line) and section 16 (the Metrics subsection);
  [ADR-0036](../architecture/adr/0036-metrics-allowlist-and-collection.md);
  `docs/operations/METRICS.md`, linked from `docs/operations/INSTALL.md`; the README's Self-hosting
  list.
- Tests: `lib/metrics/__tests__/exposition.test.ts` (8 cases),
  `lib/metrics/__tests__/handleMetricsRequest.test.ts` (10 cases),
  `lib/jobs/__tests__/scheduledJobStats.integration.test.ts` (3 cases).

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` pass, with react-doctor and fallow
reporting nothing on any file this change touched. The production build puts no metrics code in the
client bundle. `pnpm test:integration` passed 797 of 798: the one failure was the shared truncating
`beforeEach` in `tests/integration/setup.ts` timing out at ten seconds inside
`features/dashboard/__tests__/queries.integration.test.ts`, a file this change does not reach, and
that file passed all 28 cases when rerun on its own.

The handler tests hold the security properties. With no token configured the endpoint answers `404`
and never calls a collector. A missing, a malformed and a wrong credential get responses identical
to each other and to the disabled case. The credential is compared through `matchesPublicToken` (the
helper's use is asserted, not its timing, which would flake in CI). Every family carries HELP and
TYPE, and every counter ends in `_total`. No series repeats. The metric names equal the hand-written
allowlist exactly, and every label value matches a closed vocabulary. A request carrying a real uuid
never surfaces it. A failing collector and a collector that never settles both degrade to
`collector_up 0` behind a `200`. The thirty-first request in a minute is refused and audited whether
or not metrics are enabled. Neither a response body nor any log call contains the token.

The integration test runs a real worker against a real queue: a completed sweep records its count
and success time, a sweep failing twice with two attempts counts one failure, and a non-sweep job
writes nothing.

Manually, against a production build with the development stack:

- The disabled server, and the enabled one with no header or a wrong token, all return the same
  `404` body and headers.
- The correct token returns `200`, and `promtool check metrics` (the `prom/prometheus:v3.5.0` image)
  accepts the body with no output and exit code 0.
- A job with no handler and `attempts: 1` moved `remit_queue_jobs{state="failed"}` from 64 to 65. A
  real `invoice.overdue.sweep` moved its `completed` counter to 1 and set its timestamp. The
  worker's own 08:00 UTC reminder sweep had already been recorded the same way.
- A request to `/clients/<uuid>` left no path or id in any label.
- With Redis stopped, the scrape returned `200` in 2.01 seconds with both collectors at `0` and the
  process metrics intact, and both collectors returned to `1` once Redis came back.
- The token appeared in no line of either server's log or the worker's.

## Known gaps

- **No request rate, latency or error-rate metrics.** ADR-0036 names the OpenTelemetry path and the
  measurement it would need first.
- **The worker's process metrics are not reported.** The endpoint describes the app container only.
- **Scheduled-job counts live in Redis**, so flushing Redis resets them and clears the last-success
  timestamps until each sweep runs again.
- **A sweep's success is not its work's success.** `backup.run.sweep` completes on nights that take
  no backup and on nights whose backup failed, because stage 43 records a failure rather than
  retrying it. `docs/operations/METRICS.md` points backup freshness at `/settings/system` and the
  dashboard banner.
- **The `404` hides configuration, not the route.** Its JSON body differs from the framework's HTML
  not-found page for an arbitrary path, so a caller can tell the route exists; it cannot tell
  whether metrics are enabled or whether a token was close.
- **A tripped rate limit writes an audit row per refused request**, the same pattern `proxy.ts` and
  the Stripe webhook follow, so a flood from one address is also a flood of `audit_logs` rows.
- **During a Redis outage every scrape takes the full two-second bound**, and the timed-out reads
  wait in the ioredis offline queue and are replayed, harmlessly, when Redis returns.
