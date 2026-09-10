# ADR-0036: Metrics — an enforced allowlist, collected at scrape time, with no request instrumentation

- **Status:** Accepted
- **Date:** 2026-09-10

## Context

[ADR-0018](0018-no-telemetry.md) decided that Prometheus metrics are local, pull-based operational
data, exposed only behind the deployment-owned `REMIT_METRICS_TOKEN` and unavailable when it is
unset. It did not decide what those metrics are. The documentation written before the endpoint
existed listed four families: HTTP request counters by route and status code, error counters by
feature and error type, the depth of "the outbound email queue", and recurring job execution counts
and last-run timestamps.

Building it showed that list could not be taken at face value:

- **An HTTP counter needs a route pattern and a status, and nothing cheap has both.** `proxy.ts` is
  the only code every request passes through. It sees a resolved pathname, where every
  `/clients/[clientId]` is a distinct string carrying a real id, and it hands the request on with
  `NextResponse.next()` without ever seeing the status the route returns. Next.js does emit an
  OpenTelemetry root span carrying both `next.route` and `http.status_code`, but consuming it means
  registering an OpenTelemetry tracer provider, which creates a span on every request.
- **Error counters need a closed vocabulary.** `logger.error`'s `action` field is a free string at a
  few hundred call sites, and a large share of errors happen in the worker, a separate process.
- **There is no email queue.** Remit runs one BullMQ queue carrying seventeen job types, and a count
  per job name is a count of invoices rendered, reminders sent and proposals mailed.
- **The app cannot see the worker.** They are separate containers; an in-process counter in one is
  invisible to the other.

The endpoint is protected by a single shared bearer token, compared in constant time. That makes it
sound for operational signals and wrong for business data, and
[ARCHITECTURE.md's opening section](../ARCHITECTURE.md#1-what-remit-is) places client names, amounts
and business activity firmly in the second category.

## Decision

**The metric set is an explicit allowlist, and a test enforces it.** The families assembled in
`lib/metrics/collectMetrics.ts` are the only ones the endpoint can produce, and
`lib/metrics/__tests__/handleMetricsRequest.test.ts` carries the permitted names and label
vocabularies written out by hand, so a metric added later fails the build until it is argued for
there. Today that list is four process gauges, a build-info gauge, queue depth by state, per-sweep
run counts and last-success timestamps, and a per-collector health gauge.

**No count of domain rows, and no per-name job counts outside the scheduled sweeps.** A sweep runs
on a fixed clock whatever the business does, so its run count is operational; every other job maps
one-to-one onto a document or an email, so its count is commercial.

**Every label value comes from a closed vocabulary** — a queue state, a scheduled job name, a
collector name, the application version. Never a path, an id, an address or an error message.

**Collection happens at scrape time; no request path is instrumented.** Queue depth is read from
BullMQ on each scrape. The scheduled-job counts are written by the worker's own `completed` and
`failed` events into one Redis hash (`lib/jobs/stats.ts`), the only shared state the two containers
have, and read by the app when it answers the scrape. The endpoint therefore adds no cost to any
request except its own.

**A failing collector degrades the response instead of failing it.** Each Redis read is bounded,
because the shared connection options queue commands indefinitely during an outage. A collector that
fails drops its own families and reports `0` on `remit_metrics_collector_up`.

## Consequences

### Positive

- The security property survives future edits: widening what the endpoint reveals is a visible,
  reviewed change to a test, never a side effect of adding a counter.
- No dependency was added and no request pays for instrumentation.
- A Redis outage stays visible as a collector going down, rather than as a missing scrape.
- One scrape target covers both containers.

### Negative

- There is no request rate, latency or error-rate signal. An operator who wants one reads the
  reverse proxy's metrics, which see every request with its status.
- The process metrics describe the app container only. The worker's memory is not reported.
- Scheduled-job counts live in Redis, so flushing Redis resets them. Prometheus handles a counter
  reset, but the last-success timestamps disappear until each sweep runs again.

## Alternatives considered

### HTTP counters through OpenTelemetry spans

A span processor counting Next.js's root spans would give route pattern and status exactly. It was
rejected because it adds the OpenTelemetry SDK to the server graph and turns on span creation for
every request, to serve one metric family nobody has yet asked for. If request metrics become a
requirement, this is the path, and its per-request cost has to be measured before it ships.

### HTTP counters in `proxy.ts` with a hand-maintained route table

Rejected: the table would drift from `app/` silently, and `proxy.ts` still would not know the status
code.

### A metrics client library

A client library's in-process registry would hold only the process metrics; the job metrics live in
another container and have to be read from Redis regardless. For eight families with no histograms,
a formatter that throws on every rule a scraper enforces is smaller than the library's surface.
BullMQ's own `exportPrometheusMetrics` was rejected for the same reason the per-name counts were:
its output is shaped by BullMQ, not by this allowlist.

### A second scrape target on the worker

Rejected: it would give the worker its own HTTP listener and port, and the operator a second token
and target, to report a handful of numbers Redis already carries between the two containers.
