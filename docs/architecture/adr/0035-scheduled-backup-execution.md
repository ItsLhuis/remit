# ADR-0035: Scheduled backup execution — a static schedule, a session lock, and a run that does not retry

- **Status:** Accepted
- **Date:** 2026-09-09

## Context

[ADR-0023](0023-job-scheduling-bullmq-redis.md) made BullMQ the only execution model for scheduled
work and rejected an in-process scheduler because money-affecting work must survive a restart. A
backup is the most data-critical of those, and `settings.backup_cadence` had held a `daily | weekly`
value since the first migration that nothing ever read.

Giving it a consumer raises four questions the existing job layer does not answer, each of which
binds later operational work:

- **The cadence is per instance, and a cron pattern is not.** `lib/jobs/schedules.ts` holds four
  static patterns and `removeUnknownJobSchedulers` reconciles Redis against that list on every boot
  by _key_. A scheduler whose pattern tracked a settings column would have to be rewritten on every
  save, from a process (the Next.js server) that today only ever enqueues.
- **A backup can overlap itself in a way the other sweeps cannot.** The sweeps beside it select work
  and fan it out; each unit of work carries its own row-level guard. A backup takes a `pg_dump`,
  writes one archive, prunes the destination against a retention policy, and stamps the outcome onto
  a single settings row — none of which is entity-scoped, and all of which two concurrent runs would
  race.
- **It shares its data with two other heavy operations.** `remit:restore` replaces the database and
  swaps the uploads directory; `remit:rotate-encryption-key` holds an advisory lock, rewrites every
  encrypted column, and re-encrypts the `.remitbak` envelopes at the configured destination
  ([ADR-0021](0021-encryption-key-rotation.md)).
- **`DEFAULT_JOB_OPTIONS` retries five times with exponential backoff**, which is correct for a mail
  send and expensive for a `pg_dump`.

## Decision

**The schedule is static and the cadence decides at run time.** `backup.run.sweep` is registered
with one fixed six-field UTC cron pattern like every other repeatable job, and
`features/backups/services/backupSchedule.ts`'s `isBackupDue` decides whether tonight is a backup
night from the cadence and the last recorded success. Changing daily to weekly therefore writes
nothing to Redis and cannot leave a second scheduler behind. The rejected alternative — deriving the
pattern from the column and re-upserting the scheduler on save — is what
`removeUnknownJobSchedulers`'s own comment warns about, and it would have put a Redis scheduler
write on a settings mutation.

Because the decision is a comparison against the last success rather than a weekday, a weekly
instance that misses its night takes its archive the next night instead of waiting a week.

**The hour is 01:00 UTC, ahead of the other four sweeps.** `retention.purge.sweep` at 02:30 destroys
rows nothing can bring back, so an archive taken before it always still contains the last day it
purged. Taken afterwards, the most recent archive would be the first one missing them.

**The overlap guard is a Postgres session advisory lock**, `BACKUP_LOCK_ID` in
`lib/backups/backupLock.ts`, taken with `pg_try_advisory_lock` and held for the run. A deterministic
BullMQ job id was rejected as the guard: it collapses duplicate enqueues but is freed the moment the
job completes, and it is invisible to a second worker container. The lock is session-scoped rather
than transaction-scoped so a worker that dies releases it by ending its session, with nothing having
to notice the crash. It is tried and not waited on, because a backup that queues behind another
backup helps nobody.

**A scheduled run refuses while a key rotation is in progress**, by testing `ROTATION_LOCK_ID` and
releasing it again. An archive uploaded after the rotation's re-encryption pass has listed the
destination is one the rotation never re-encrypts, and it would stay readable only by the retired
key. The lock is tested rather than held for the run because `runRotation` deliberately drops and
re-acquires it around its own pre-rotation backup; holding it would abort a rotation already under
way.

**A failed scheduled backup does not retry.** The handler records the outcome — the two
`settings.backup_last_failure_*` columns and an `instance.backup.failed` audit entry, both written
by the shared pipeline — and returns, so the job completes. A destination that is misconfigured
fails identically on all five attempts, at the cost of five dumps and five archive writes; the retry
is the next occurrence.

**One producer of `.remitbak` archives.** `scripts/core/backup/executeBackup.ts` is the whole
non-interactive pipeline and both entry points run exactly it: `runBackup.ts` wraps it for the
operator with spinners and the overwrite confirmation, and the sweep calls it directly. The split
exists because a worker's stdout is the pino log stream an operator reads to find an error, and
because the archive format is a contract `remit:restore` depends on.

**On a hosted instance the sweep does nothing.** The scheduler is still registered, so
`REPEATABLE_JOBS` stays static; the refusal is one branch in the handler, beside the one
`features/settings/backup/mutations.ts` already makes for the same reason
([ADR-0014](0014-hosted-offering.md)).

## Consequences

### Positive

- A cadence change takes effect on the next night with no Redis write, and exactly one scheduler
  exists for this job across restarts by construction rather than by reconciliation.
- Two worker containers, a re-delivered job and an operator's own run cannot produce two archives at
  once, and a crashed worker does not leave the guard held.
- A missed backup is visible as the _absence_ of a recent success rather than the presence of a
  failure row, so a worker that never ran at all surfaces the same way as one that failed.

### Negative

- The sweep wakes nightly on a weekly instance to decide it has nothing to do. The cost is one
  indexed settings read.
- A transient failure — a destination unreachable for a minute — waits for the next occurrence
  rather than retrying within the hour.
- The lock is held by the scheduled path only. A `pnpm remit:backup` run and a scheduled one can
  still overlap, because pushing the guard into the shared pipeline would change the command's
  behaviour and would have to exempt the pre-restore snapshot and the pre-rotation backup, which
  call the same pipeline and must never be refused.
- Nothing stops a scheduled backup starting during a `remit:restore`. The uploads swap is two
  renames, and an archive taken between them would record an empty uploads mirror beside a
  successful outcome. Closing it belongs to a change that owns the restore command.

## Alternatives considered

### A cadence-derived cron pattern, re-upserted when the setting changes

BullMQ's `upsertJobScheduler` does override an existing scheduler's pattern in place, so this is
workable. It was rejected because it puts a Redis scheduler write inside a settings mutation, makes
the schedule's correctness depend on that write having succeeded, and leaves
`removeUnknownJobSchedulers` — which reconciles keys, not patterns — unable to detect the drift it
exists to prevent.

### A weekday anchor for the weekly cadence

Simpler to express as a pattern, and it makes a missed week a missed week. Comparing against the
last success instead lets the schedule catch up the following night, which is the behaviour an
operator expects from something whose only job is to have a recent archive.

### Spawning `remit:backup` as a child process from the worker

No refactor at all, and the CLI's exit codes become the contract. Rejected: a second Node runtime
inside a container that already has one, an archive whose failure reaches the worker as an exit
status rather than an error, and a `.remitbak` producer mediated by argv.
