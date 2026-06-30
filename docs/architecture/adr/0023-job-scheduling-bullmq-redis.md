# ADR-0023: Background jobs and scheduling via BullMQ + Redis

- **Status:** Accepted
- **Date:** 2026-06-30

## Context

Several features require scheduled or asynchronous execution: recurring-invoice generation on a
`next_run_at` date, overdue detection, due/overdue reminder emails, and PDF rendering (ADR-0022,
which must not run inline in a request). Three execution models are candidate options: an in-process
`setInterval` scheduler, a separate worker process, and a BullMQ-style queue backed by Redis.

The in-process scheduler is the simplest but loses scheduled work on restart, cannot retry failed
jobs durably, and risks duplicate runs if more than one app process ever exists. A bare worker
process solves durability only if it carries its own persistent queue. Money-affecting jobs
(generating an invoice, sending a reminder) must run exactly once and survive a restart, which makes
durable, retryable job state the deciding criterion.

## Decision

Background jobs and scheduling use BullMQ backed by Redis. Job producers (server actions, cron-style
repeatable jobs) enqueue typed jobs; a worker consumes them with durable retries, backoff, and
exactly-once-style guards keyed on the domain entity (e.g. a recurring schedule's occurrence) so a
retry never double-generates an invoice or double-sends an email. Repeatable jobs cover recurring
generation, overdue detection, and reminder scheduling.

Redis is shared infrastructure with a deliberate dual purpose: the job queue and a planned
application cache layer. Adding Redis is a conscious departure from the otherwise
zero-extra-infrastructure stance; it is justified by the durability and exactly-once requirements of
money-affecting jobs and amortized by the cache use. Redis is provisioned in the deployment Compose
stack and validated at boot through `lib/config/env.ts`; the cache layer is recorded in its own ADR.

Job-side business logic stays in pure services per ADR-0007 (e.g. `computeNextRunDate`,
`shouldGenerateInvoice`, retainer-pool math). The worker is a thin orchestrator that loads data,
calls services, performs writes, and emits domain events, mirroring the server-action pattern.

## Consequences

### Positive

- Scheduled and async work is durable: jobs survive restarts, retry with backoff, and do not run
  twice when guarded by an entity-scoped idempotency key.
- One mechanism covers recurring invoices, overdue detection, reminders, and PDF rendering.
- Redis is reusable as a cache and as the rate-limiter backend for multi-instance deploys, which
  [ARCHITECTURE.md Security architecture](../ARCHITECTURE.md#9-security-architecture) already
  anticipated.

### Negative

- Redis is now a hard infrastructure dependency for any deployment that uses scheduled features.
- A worker process and Redis container expand the deployment surface and the operational runbook.
- Exactly-once delivery is not free; jobs must carry idempotency guards rather than assuming single
  delivery.

## Alternatives considered

### In-process `setInterval` scheduler

No external dependency and trivial to write, but loses scheduled work on restart, offers no durable
retry, and risks duplicate or missed runs. Rejected because recurring-invoice and reminder jobs are
money-affecting and must be durable and idempotent.

### Standalone worker process with an ad-hoc queue

A separate Node process improves isolation but only achieves durability by reimplementing a
persistent queue. Rejected in favor of a proven queue (BullMQ) over building one.
