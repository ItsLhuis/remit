# DR-0043 — Scheduled backups

- **Status:** Shipped
- **Date:** 2026-09-09
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0020, ADR-0021, ADR-0023, ADR-0035
- **Supersedes:** —

## What

Backups run on the configured cadence through the BullMQ worker, and a dashboard banner tells the
owner when one is overdue, has never run, or failed.

## Why

Every part of a backup worked except the part that makes it a backup rather than a chore.
`pnpm remit:backup` wrote an encrypted archive, uploaded it, enforced three retention tiers and
recorded its outcome — only when a person remembered to run it. `settings.backup_cadence` had been
in the schema since the beginning, was settable on `/settings/backup`, and was read by nothing.

The failure mode that follows is the quiet one. An operator configures a destination, runs one
backup, sees it succeed, and never runs another; the instance then carries a backup posture that
looks configured and is inert. `/settings/system` judged freshness from `backup_last_success_at`,
but an owner has no reason to open a health page on a day when nothing appears wrong, so the one
surface that knew was the one nobody looked at.

## Scope

Included: a repeatable sweep on BullMQ that decides whether a backup is due and runs one; a
crash-safe guard that stops the scheduled path overlapping itself across workers and re-deliveries,
and stands it down during a key rotation; the same status columns, audit entries and retention
safety the manual command already wrote; and a dashboard banner covering the four states an owner
can be in.

Excluded, with reasons:

- **A cadence-shaped cron pattern.** The scheduler pattern stays static and the cadence is read at
  run time by a pure service. A pattern derived from a database value has to be re-registered when
  that value changes, and a scheduler lives in Redis until something deletes it.
- **A "run a backup now" button.** The capability here is the schedule. A manual trigger is a
  different surface with its own progress and failure reporting, and `pnpm remit:backup` already
  covers the operator who wants one immediately.
- **Multi-destination fan-out.** `docs/architecture/specs/BACKUP-ARCHIVE.md` defers it and a run
  writes one destination.
- **Dismissing the banner.** It is derived state that clears itself the moment a backup succeeds.

## How

The pipeline was split before it was scheduled. `scripts/core/backup/executeBackup.ts` is the whole
non-interactive backup — plan, dump, archive, upload, prune, record — and `runBackup.ts` became a
wrapper that adds the spinners, the plan note and the overwrite confirmation through a single
`onPlanned` hook. Calling the command directly from the worker would have interleaved clack's box
drawing into the pino stream an operator reads to find an error, and forking the pipeline would have
given `.remitbak` two producers when `remit:restore` accepts one format.

The schedule is one static cron pattern. `backup_cadence` is per instance and a pattern is not, so
the pattern never varies and `isBackupDue` decides at run time from the cadence and the last
recorded success. That is what makes a cadence change leave exactly one scheduler in Redis: nothing
about the scheduler changes, so `removeUnknownJobSchedulers` has nothing to reconcile. It also makes
a weekly instance that misses its night take the archive the next night rather than waiting a week,
because the decision compares against a success rather than a weekday.

The hour, 01:00 UTC, is a data-safety choice. `retention.purge.sweep` at 02:30 hard-deletes rows
nothing can restore; an archive taken before it always still holds the last day it destroyed.

The overlap guard is a Postgres _session_ advisory lock rather than a BullMQ job id, because a job
id is freed the moment the job completes and is invisible to a second worker container, and because
a session lock is released by a dying worker's session ending rather than by anything noticing the
crash. The sweep additionally tests — and immediately releases — the key-rotation lock, since a
rotation re-encrypts the archives at the destination and one uploaded behind that pass would keep
the retired key; it is tested rather than held because `runRotation` deliberately drops that lock
around its own pre-rotation backup.

A failure is recorded and not rethrown, so the job completes instead of taking five `pg_dump`s at
exponential backoff over a destination that is misconfigured in exactly the same way each time.

The banner derives from the **absence of a recent success**, not from the presence of a failure row.
That is the load-bearing choice in Part 4: a failure row only exists if something ran, so a worker
that was never started, a queue that never delivered, or a job name with no handler would all leave
a green surface if the banner keyed on failures. Keying on age catches every one of them.

## Evidence

- Pipeline split: `scripts/core/backup/executeBackup.ts` (`executeBackup`), with
  `scripts/core/backup/runBackup.ts` reduced to the interactive wrapper and re-exporting
  `BackupCliError`, `redactBackupReason` and `BackupResult` for its existing callers.
  `scripts/core/backup/plan.ts`'s `buildBackupPlan` narrowed from `BackupCliOptions` to the two
  fields it reads.
- Schedule: `lib/jobs/schedules.ts` (`backup.run.sweep`, `0 0 1 * * *`, UTC), `lib/jobs/types.ts`
  (`JobMap` entry and its `JOB_NAME_KEYS` mirror).
- Handler: `features/backups/jobs.ts` (`runScheduledBackup`, `isKeyRotationRunning`), registered for
  the worker by `scripts/core/worker/loadWorkerFeatureModules.ts` and declared in `.fallowrc.json`'s
  `dynamicallyLoaded`.
- Overlap guard: `lib/backups/backupLock.ts` (`BACKUP_LOCK_ID`, `acquireBackupLock`,
  `releaseBackupLock`), modelled on `scripts/core/keyRotation/lock.ts`.
- Cadence and banner logic: `features/backups/services/backupSchedule.ts` (`isBackupDue`,
  `evaluateBackupBannerState`), pure and IO-free.
- Banner: `features/backups/queries.ts` (`getBackupBanner`, owner-only and hosted-mode excluded),
  `features/backups/components/BackupStatusBanner.tsx`, `app/(dashboard)/DashboardBackupBanner.tsx`,
  wired into `app/(dashboard)/page.tsx` behind its own Suspense boundary. Keys in
  `lib/i18n/types.ts` and `lib/i18n/locales/en.tsx` under `backups.banner.*`.
- Decisions: [ADR-0035](../architecture/adr/0035-scheduled-backup-execution.md), cited from
  `ARCHITECTURE.md` section 14 and `operations/CLI-CONTRACT.md`.
- Tests: `features/backups/services/__tests__/backupSchedule.test.ts` (17 cases),
  `features/backups/__tests__/scheduledBackup.integration.test.ts` (4 cases).
- `vitest.integration.config.ts` sets `REMIT_DATA_DIR` to `.tmp/integration-data`, because the
  variable defaults to `data` and the suite now writes archives.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm build` and
`pnpm build:scripts` all pass, together with react-doctor and fallow against their configs.

The integration file is the one that matters, and it runs against a real queue, a real worker and a
real `pg_dump` — only the dump binary is a shim delegating to the Dockerized test Postgres, which is
what the backup command's own integration test already does. It proves four things: the sweep
enqueued through `enqueueJob` reaches the handler and writes a `.remitbak` archive while stamping
`backup_last_success_at` and an `instance.backup.completed` entry carrying `worker/backup`; a second
sweep inside the cadence writes no second archive; a sweep that finds the advisory lock held writes
no archive and leaves the status untouched; and a misconfigured destination records a translated
failure reason with no credential in the audit metadata. Stage 28's handler-coverage test stays
green with the new name in the catalog.

The cadence and banner boundaries are covered as pure functions at the day before, the day of, and
one millisecond either side of each threshold, under a frozen clock.

Not covered by an automated test: the dashboard banner's rendering, which has no component test —
its three states are decided by a service that is tested exhaustively, and the component is a
presentational `Alert` with no state machine, no conditional rendering beyond a three-way map and no
form. The manual smoke below is what covers the rendering, the restore of a scheduled archive, and
the scheduler count in Redis across a restart.

## Known gaps

- **The lock is one-sided.** A `pnpm remit:backup` run and a scheduled one can still overlap. The
  guard sits at the scheduled path because pushing it into the shared pipeline would change the
  command's behaviour and would have to exempt the pre-restore snapshot and the pre-rotation backup,
  which run the same pipeline and must never be refused. Closing it belongs to a change that owns
  the CLI.
- **Nothing stops a scheduled backup starting during a `remit:restore`.** The uploads swap in
  `scripts/core/restore/uploadsSwap.ts` is two renames, and an archive taken between them would
  record an empty uploads mirror beside a successful outcome. Closing it means the restore command
  taking the same lock.
- **A backup taken after a rotation but before the key is swapped in the environment** fingerprints
  the retired key against columns already rewritten. This predates the schedule and applies equally
  to a manual run; ADR-0021's post-run operator instructions are what cover it today.
- **The banner carries no dates.** It says the state and links to `/settings/backup`, where the last
  success and the last failure already are. Rendering a date would have meant threading the
  instance's locale and time zone into a surface that reads one settings row.
- **`backup.run.sweep` has no E2E spec.** Flow 4's Playwright spec covers a repeatable sweep through
  the real worker; a second one for backups would need `pg_dump` and a destination inside the CI
  stack, and `.github/workflows/e2e.yml` cannot reach the queue there at all today (see the ledger's
  D1b).
