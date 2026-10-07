# Background work integrity

- **Status:** Shipped
- **Date:** 2026-10-07
- **Verdict:** Complete
- **Decisions:** ADR-0020, ADR-0021, ADR-0023, ADR-0041, ADR-0046, ADR-0047, ADR-0048
- **Supersedes:** —

## What

The operational work nobody watches — backups, restores, key rotations, webhook deliveries, the
worker process and the request error log — can no longer collide, outlive its own records or fail
without a trace.

## Why

Each of these went wrong silently. Only the scheduled backup took the backup lock, so an operator's
`pnpm remit:backup` could run beside it and race the same retention pass, and a scheduled backup
could start while a restore was writing and deleting stored files. A restore printed the archive's
schema migration and compared it with nothing, so an archive from newer code was applied and
"migrated" by a build that could not run backwards. Local archives were never pruned, and the local
destination test left an empty probe directory behind. A webhook delivery whose job ran out of
attempts without recording its last one stayed `pending` forever. A worker that crashed on an
unhandled rejection after it had started was never reported. A request error with a DSN set was
logged twice, once by Next.js and once with its event id. And on Windows every backup and restore
handed `pg_dump` and `pg_restore` an argument array through a shell, which Node 24 deprecates with a
warning on every run.

## Scope

Included: one backup lock taken by every path that produces a backup or swaps restored data, with
the internal backups of a restore and a rotation running under the lock their operation holds; a
schema gate on restore; local retention; a probe-free local destination test; webhook deliveries
settled when their job is exhausted, and stranded `pending` deliveries failed by a stated rule;
worker crash reporting; a request error logged once; static command lines for the PostgreSQL client
tools; a restore that removes its staging directories on every exit.

Excluded: what a backup contains and archive format version 2 (ADR-0046); the job catalog's
semantics; what error tracking transmits beyond a new process phase; the window between a key
rotation and the key swap, which is a decision the owner has not taken; reporting errors thrown in
the proxy, found here and recorded in the pack's register because it changes the reporting boundary
rather than the request log.

## How

**One lock, taken by the operation.** The sweep, `pnpm remit:backup`, `remit:restore` and the key
rotation each hold `BACKUP_LOCK_ID` for their run; the backup pipeline itself takes no lock, so a
restore's pre-restore snapshot and a rotation's pre-rotation backup run under the lock their
operation already holds and are never refused (ADR-0047). The restore takes it before its snapshot
and holds it until the process ends; the rotation holds it for the whole non-dry run, which also
covers the moment it drops its own rotation lock for the backup. A held lock is refused rather than
waited on. The holding session carries its holder and start time as its `application_name`, set in
the same statement that takes the lock, and a refused caller reads it back from `pg_stat_activity`
to say what is running and since when.

**Restore across schemas.** The archive's `schemaMigrationId` is compared with the last tag of the
running build's migration journal. A tag the journal does not hold is treated as newer and refused,
dry run included, because migrations only run forwards. An older one is restored and migrated
forward after a warning that names both migrations; an interactive run confirms it, an unattended
run must pass `--accept-older-schema`. The restore also stopped calling `process.exit` inside its
`try`, which had skipped the `finally` that removes the staged dump and files.

**Local retention.** A local backup written to the default path prunes the backups directory with
the same pure `computeRetentionDeletions` the remote pass uses, over archives whose names the backup
wrote itself, dated by the time in the name. The archive just written, a pre-restore snapshot, a
pre-rotation backup and an archive written to `--output` are never selected. Deleting the last key
under a prefix of the local destination now removes the emptied directories, up to but never
including the backup directory, so the connection test's probe leaves nothing behind.

**No delivery left pending.** A job handler may register an exhausted handler, which the worker
calls once BullMQ gives up on the job by the same final-attempt rule it reports with. The webhook
job's handler settles a still-`pending` delivery `failed`, keeping the status code and attempt log
its recorded attempts left, and counts it toward the endpoint's failure streak. Every completed
delivery also fails any delivery still `pending` a day after creation, on any endpoint, without
counting it toward a streak: the retry schedule runs in about sixteen minutes, so such a delivery
has no attempt left coming.

**The worker and the request log.** The worker installs `unhandledRejection` and `uncaughtException`
handlers that report with the new `process.phase` `run`, log the event id, flush within a bound, and
exit non-zero, with a hard deadline should the report hang (ADR-0048). At the request boundary
Next.js logs every request error itself and offers no supported way to stop it, so `onRequestError`
logs a receipt — event id, route, error type and digest — instead of the error a second time.

**PostgreSQL tools.** `pg_dump` and `pg_restore` start through one helper: directly with an argument
array off Windows, and on Windows as a single command line joined from arguments checked to be
static. `pg_restore` now receives its target through the `PG*` variables and
`--dbname=postgresql://` instead of the connection URL on its command line.

## Evidence

- `lib/backups/backupLock.ts`, `lib/backups/backupLockHolder.ts`, `features/backups/jobs.ts`,
  `scripts/core/backup/runBackup.ts` (`runOperatorBackup`), `scripts/backup.ts`,
  `scripts/core/restore/runRestore.ts`, `scripts/core/restore/auditTrail.ts`,
  `scripts/core/keyRotation/runRotation.ts`.
- `scripts/core/restore/schemaGate.ts`, `scripts/core/restore/confirm.ts`
  (`confirmOlderArchiveSchema`), `scripts/core/restore/args.ts`,
  `scripts/core/restore/dryRunSummary.ts`.
- `scripts/core/backup/filename.ts` (`parseBackupFilenameTimestamp`),
  `scripts/core/backup/writeArchive.ts` (`enforceLocalRetention`),
  `scripts/core/backup/executeBackup.ts`, `lib/backups/destination.ts`, `lib/i18n/locales/en.tsx`
  (`settings.backup.retentionLocalNote`).
- `lib/jobs/attempts.ts`, `lib/jobs/registry.ts`, `lib/jobs/worker.ts`, `features/webhooks/jobs.ts`,
  `features/webhooks/delivery.ts` (`settleExhaustedWebhookDelivery`, `pruneDeliveries`),
  `features/webhooks/services/deliveryPolicy.ts` (`getStrandedDeliveryCutoff`).
- `scripts/core/worker/crash.ts`, `scripts/worker.ts`, `lib/errorTracking/errorEvent.ts`,
  `instrumentation.ts`.
- `scripts/core/utils/process.ts` (`spawnPostgresTool`), `scripts/core/backup/databaseDump.ts`,
  `scripts/core/restore/restoreDump.ts`.
- The rotation's dry run and audit-trail reads moved to `scripts/core/keyRotation/dryRun.ts` and
  `progressTrail.ts` to keep `runRotation.ts` under the size ceiling.
- Tests: `scripts/core/backup/__tests__/backupLock.integration.test.ts`,
  `features/backups/__tests__/scheduledBackup.integration.test.ts`,
  `scripts/core/restore/__tests__/restore.integration.test.ts` (schema gate, lock refusal, staging
  cleanup), `features/webhooks/__tests__/deliveryQueue.integration.test.ts`,
  `features/webhooks/__tests__/delivery.integration.test.ts`,
  `lib/backups/__tests__/backupLockHolder.test.ts`,
  `lib/backups/__tests__/localDestination.test.ts`,
  `scripts/core/backup/__tests__/filename.test.ts`,
  `scripts/core/backup/__tests__/localRetention.test.ts`,
  `scripts/core/restore/__tests__/schemaGate.test.ts`,
  `scripts/core/restore/__tests__/restoreDump.test.ts`, `lib/jobs/__tests__/attempts.test.ts`,
  `lib/jobs/__tests__/workerFailureReporting.test.ts`,
  `scripts/core/worker/__tests__/crash.test.ts`, `scripts/core/utils/__tests__/process.test.ts`,
  `features/webhooks/services/__tests__/deliveryPolicy.test.ts`,
  `lib/errorTracking/__tests__/instrumentation.test.ts`.
- Documents: ADR-0047, ADR-0048, `docs/operations/RESTORE.md`,
  `docs/architecture/operations/CLI-CONTRACT.md`, `docs/architecture/specs/BACKUP-ARCHIVE.md`,
  `docs/architecture/ARCHITECTURE.md`, `.agents/rules/errors.md`.

## Verification

`pnpm typecheck` passed. `pnpm lint` passed with the two `max-lines` warnings that predate this
work. `pnpm format:check` passed. `pnpm test:coverage` passed, 315 files and 2,746 tests, with the
services threshold met. `pnpm test:integration` passed, 100 files and 924 tests.
`pnpm vitest run tests/docs` passed. `pnpm build` and `pnpm build:scripts` passed. fallow's audit
against the previous commit passed with no introduced finding, and react-doctor reported no error
and no finding in a touched file.

A manual smoke ran against the Dockerized test stack, with `pg_dump` and `pg_restore` delegated to
its Postgres container and a real worker process. With a manual backup held at its overwrite prompt,
an enqueued sweep logged that it skipped because `manual-backup` held the lock, and a second
`pnpm remit:backup` was refused naming the holder and its start time; killing the held process
released the lock. During a `remit:restore` the lock was labelled `restore`, an enqueued sweep
skipped naming it, and the restore completed and left no staging directory. A dry run printed the
schema comparison. With daily retention of two and archives named for the two previous days, a
backup left today's and yesterday's archives and the pre-restore snapshot. The local connection test
left its directory empty. A webhook test delivery to a refused port ended `failed` after six
attempts. A worker crashed by an injected unhandled rejection exited 1, logged `worker.crash` with
an event id, and a local receiver standing in for Sentry received that event tagged
`process.phase: run` with its message withheld. A rendering error on the standalone server with a
DSN set produced one Next.js error entry and one receipt line carrying the same digest and the event
id the receiver received.

Not covered by hand: an older and a newer archive were restored only through the integration tests,
which drive the real restore command against the test database with the archive's recorded migration
overridden; the worker ran on the host, so a container restart after the crash was not observed; the
smoke receiver was a local HTTP listener, not GlitchTip or Sentry. The same smoke found that an
error thrown in the proxy reaches neither the receiver nor the log with an id: Next.js reads the
proxy's instrumentation from an entry the Node-runtime build never sets, so `onRequestError` is not
called for it. That is recorded as a new gap rather than fixed here.

## Known gaps

None.
