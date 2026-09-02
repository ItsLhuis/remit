# DR-0017: Recurring invoices and the job runtime

- **Status:** Shipped
- **Date:** 2026-08-05
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0023
- **Supersedes:** —
- **Reconstructed:** yes

## What

The BullMQ worker and its repeatable schedules, and recurring invoice schedules — including the
retainer model — that generate invoices on their next-run date.

## Why

Retainers and subscriptions are how a large share of freelance income actually arrives, and
regenerating the same invoice by hand every month is exactly the work Remit exists to remove. Doing
it needed something that runs when nobody is looking at a browser, which is the same thing overdue
detection and reminder dispatch needed.

## Scope

Included: the queue, the worker runtime as its own container service, typed job payloads, the
repeatable schedulers registered on boot, recurring schedules with weekly, monthly, quarterly and
yearly cadences, end conditions by date or count, the retainer model with included hours and an
overage rate, generation as a draft or auto-sent, overdue detection and reminder scheduling.

Excluded: running jobs inside the web container. The worker is a separate long-lived process,
because a job that outlives a request has nowhere to run in a serverless-shaped app and because a
stuck job should not consume a request handler. Also excluded: a cron daemon on the host — the
schedule lives in Redis so it survives a container restart without host configuration.

## How

Job payloads are typed in one catalog and the compiler rejects an enqueue whose name or payload does
not match, which is what stops a producer and a consumer drifting apart silently.

`assertValidJobId` enforces two rules BullMQ does not make obvious and that had already caused
silent failures: a custom job id may not contain `:` and may not be an integer string. An id built
as `recurring.invoice.generate:<id>:<date>` never queued at all — the job simply did not run, with
no error anywhere. Both callers now build dot-separated ids and the guard makes a regression loud.

The job id is also the idempotency key. `recurring.invoice.generate.<scheduleId>.<occurrenceKey>`
and `invoice.reminder.send.<invoiceId>.<phase>.<offsetDays>` are entity-scoped, so a retry or a
duplicate sweep cannot double-generate an invoice or double-send a reminder — which is the whole
reason the id has to be correct.

The sweep jobs carry no payload deliberately: their input is whatever the database says is due right
now, and a payload would be a snapshot that could be stale by the time the job ran.

## Evidence

- `lib/jobs/` — `queue.ts`, `worker.ts`, `schedules.ts`, `registry.ts`, `types.ts`, `enqueue.ts`,
  `jobId.ts`, `connection.ts`
- `scripts/worker.ts`, `docker-compose.yml` — the `worker` service
- `features/recurringInvoices/services/computeNextRunDate.ts`, `shouldGenerateInvoice.ts`,
  `retainerPool.ts`, `buildBlueprint.ts`, `canTransitionRecurringInvoiceStatus.ts`
- `features/recurringInvoices/jobs.ts`, `features/invoices/jobs.ts`,
  `features/invoices/systemWrites.ts`
- `database/schema/recurringInvoices.ts`
- `docs/architecture/adr/0023-job-scheduling-bullmq-redis.md`,
  `docs/architecture/operations/CLI-CONTRACT.md` — the `scripts/worker.ts` section

## Verification

Service tests cover next-run arithmetic, the generation predicate, the retainer pool and the
blueprint build. `features/recurringInvoices/__tests__/generation.integration.test.ts` covers
generation against a real Postgres. `lib/jobs/__tests__/` covers the queue round trip and the job id
guard, including the colon and integer rejections. CI runs a Redis service alongside Postgres for
the integration suite.

Not covered by an automated test: the repeatable schedulers actually firing on their cadence over
real elapsed time. Tests invoke the handlers directly with a frozen clock.

## Known gaps

`settings.backup_cadence` has no `JobMap` entry and nothing schedules a backup, so the scheduled
backups the architecture describes do not run.
