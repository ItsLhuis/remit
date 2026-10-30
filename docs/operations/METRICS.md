# Remit Metrics Runbook

This runbook points a Prometheus scraper at a Remit instance. Metrics are off until you turn them
on, and when on they are protected by one bearer token and nothing else.

## What an operator can observe

Five surfaces, and no others:

- `GET /api/health` is public and returns `200` with `{"ok":true,"version":"..."}`, or `503` with
  `{"ok":false,"reason":"Database unavailable"}`. It checks that PostgreSQL answers `SELECT 1` and
  nothing else (`app/api/health/route.ts`, `features/health/queries.ts`). The `app` container's
  Docker health check calls it (`docker-compose.yml`), and so can an uptime monitor.
- `GET /api/metrics` serves Prometheus metrics to a scraper holding `REMIT_METRICS_TOKEN`; the rest
  of this runbook covers it.
- `/settings/system` is the status page for the owner role (`requireRole("owner")` in
  `app/(dashboard)/settings/system/page.tsx`). It runs these checks (`features/health/queries.ts`):
  database connectivity; pending or unexpected migrations; the backup destination (a write test of
  the data directory, or a head request on the remote bucket); data-directory disk and inode use,
  flagged at 90% or more; whether `REMIT_PUBLIC_URL` answers from the server; the last successful
  backup, flagged when none exists or the newest is older than seven days, beside the destination
  and the last failure; whether email and Stripe are configured and have passed their test; and
  whether `SENTRY_DSN` is set. It also shows the running version, a short fingerprint of the
  encryption key, and links to `CHANGELOG.md` and [`UPGRADE.md`](UPGRADE.md).
- The container's stdout carries the pino log stream (`lib/logger/index.ts`), which is where an
  error is found in full.
- With `SENTRY_DSN` set, unhandled request errors in the app and failures in the worker are also
  reported to a Sentry-compatible receiver (`instrumentation.ts`, `scripts/worker.ts`).

## What `/api/metrics` exposes

The response is the Prometheus text exposition format, version 0.0.4, and is pull only: nothing is
pushed anywhere. It exposes exactly the following, and
`lib/metrics/__tests__/handleMetricsRequest.test.ts` fails on anything else
(`lib/metrics/collectMetrics.ts`).

| Metric                                               | Type    | Labels           | Source                        |
| ---------------------------------------------------- | ------- | ---------------- | ----------------------------- |
| `remit_build_info`                                   | gauge   | `version`        | the app process               |
| `process_start_time_seconds`                         | gauge   | none             | the app process               |
| `process_resident_memory_bytes`                      | gauge   | none             | the app process               |
| `nodejs_heap_size_used_bytes`                        | gauge   | none             | the app process               |
| `remit_queue_jobs`                                   | gauge   | `state`          | BullMQ, read from Redis       |
| `remit_scheduled_job_runs_total`                     | counter | `job`, `outcome` | the worker, recorded in Redis |
| `remit_scheduled_job_last_success_timestamp_seconds` | gauge   | `job`            | the worker, recorded in Redis |
| `remit_metrics_collector_up`                         | gauge   | `collector`      | the scrape itself             |

`state` is one of `waiting`, `active`, `delayed`, `prioritized`, `waiting-children` and `failed`
(`lib/jobs/stats.ts`). `job` is one of the six repeatable sweeps in `lib/jobs/schedules.ts`, and
`outcome` is `completed` or `failed`, where a failure counts once, after its last retry. A job that
has never completed has no `remit_scheduled_job_last_success_timestamp_seconds` sample. `collector`
is `queue` or `scheduled_jobs`. Every label value comes from a closed vocabulary; none is a path, an
id or an error message.

Nothing else is exposed, on purpose. There is no count of domain rows such as invoices, clients or
revenue, because a single shared bearer token is not the protection that business data deserves.
There is no per-job-name count for anything but the sweeps, because a count of rendered invoices or
sent reminders is the same business volume seen through a keyhole. There are no HTTP request or
error counters.

Collection happens at scrape time and costs a request nothing: no request path is instrumented. The
process gauges are read in the app container. The queue gauge is one `getJobCounts` call against
Redis. The scheduled-job metrics are written into one Redis hash by the worker's `completed` and
`failed` events (`lib/jobs/stats.ts`), because the worker runs in another container from the app
that answers the scrape. Each collector has a two-second bound. A collector that fails or times out
drops its own metrics and reports `0` on `remit_metrics_collector_up`, and the scrape still returns
`200` with everything else (`lib/metrics/collectMetrics.ts`).

The endpoint answers only a request carrying `Authorization: Bearer <token>` that matches
`REMIT_METRICS_TOKEN`, compared in constant time. No route serves `/api/metrics` itself: `proxy.ts`
rewrites an admitted scrape to `/api/metrics/scrape`, and every other request (no credential, a
wrong one, or no token configured) is answered as a path with no route, so a caller cannot learn
whether metrics are enabled (`lib/metrics/admission.ts`). Scrapes carry `Cache-Control: no-store`
and `X-Robots-Tag: noindex, nofollow`.

## 1. Set the token

Generate a token and put it in `.env`:

```bash
openssl rand -base64 32
```

```bash
REMIT_METRICS_TOKEN=<the generated value>
```

Restart the app so it reads the new value:

```bash
docker compose up -d app
```

With the variable empty, `GET /api/metrics` answers as a path with no route: a redirect to the
sign-in page, or the not-found page for a browser that is signed in. That is also the answer to a
missing or wrong token, so a redirect or a `404` after this step means the token did not reach the
container or the scraper is not sending it — the endpoint gives no more specific answer on purpose.
Prometheus follows the redirect by default and then reports the target down, because the sign-in
page is not in the exposition format.

## 2. Check it by hand

```bash
curl -H "Authorization: Bearer <token>" https://remit.example.com/api/metrics
```

A working endpoint returns `200` with lines like `remit_queue_jobs{state="failed"} 0`.

## 3. Add the scrape job

```yaml
scrape_configs:
  - job_name: remit
    scheme: https
    metrics_path: /api/metrics
    scrape_interval: 15s
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/remit-token
    static_configs:
      - targets: ["remit.example.com"]
```

`credentials_file` keeps the token out of the Prometheus configuration. Scrape no more often than
every 5 seconds: the endpoint allows 30 requests per client IP per minute and answers `429` above
that.

## What to alert on

| Signal                                                           | Meaning                                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `remit_queue_jobs{state="failed"}` rising                        | A background job exhausted its retries; the worker log says which                                                                           |
| `time() - remit_scheduled_job_last_success_timestamp_seconds`    | A sweep has not completed; above 26 hours is a missed night for the nightly ones, and above 2 hours for the hourly `storage.deletion.sweep` |
| `increase(remit_scheduled_job_runs_total{outcome="failed"}[1d])` | A sweep failed after its last retry                                                                                                         |
| `remit_metrics_collector_up == 0`                                | The app cannot read Redis; queue and job metrics are missing                                                                                |

A sweep's timestamp records the sweep running, not the work it decided to do. `backup.run.sweep`
completes every night, including the nights its cadence takes no backup, and it records a failed
backup and completes rather than retrying — so neither metric says whether an archive was written.
Backup freshness is on `/settings/system`, and the dashboard banner tells the owner when one is
overdue or failed.

## Security notes

- The token is the only protection. Treat it like a password, rotate it by changing `.env` and
  restarting, and scrape over HTTPS so it is not sent in the clear.
- The endpoint exposes no business data — no counts of invoices, clients or payments — and no label
  carries a path, an id or an error message. Nothing is ever pushed out of the instance.
- Metrics describe the app container's process and the shared job queue. The worker's own memory is
  not reported.

## Execution

`lib/metrics/__tests__/` runs the endpoint's behaviour: admission and the token, the exposition
format, the closed set of metrics and labels, and degrading when a collector fails. The scrape
configuration in step 3 has not been run against Prometheus.
