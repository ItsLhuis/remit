# ADR-0047: One backup lock for every backup, restore and key rotation

- **Status:** Accepted
- **Date:** 2026-10-07
- **Supersedes:** [ADR-0035](0035-scheduled-backup-execution.md) where it holds the backup lock on
  the scheduled path only. Every other point of ADR-0035 stands.

## Context

ADR-0035 introduced `BACKUP_LOCK_ID`, a Postgres session advisory lock, and took it on the scheduled
sweep alone. Its consequences recorded what that left open: an operator's `pnpm remit:backup` could
run beside a scheduled backup, both dumping the same database and racing the same retention pass;
and nothing stopped a scheduled backup starting while `remit:restore` wrote stored files, swapped
the database and deleted the files the archive lacked, so an archive taken in between would hold a
store and a database that never existed together. Pushing the lock into the shared pipeline was
rejected then because the pre-restore snapshot and the pre-rotation backup run the same pipeline and
must never be refused.

## Decision

**Every path that writes an archive or swaps restored data holds the one lock.** The scheduled sweep
holds it for its run, as before. `pnpm remit:backup` holds it for its run. `remit:restore` takes it
before its pre-restore snapshot and holds it until the process ends. `remit:rotate-encryption-key`
takes it after its dry-run check and holds it for the whole rotation, which also covers the moment
ADR-0021 drops the rotation lock for the pre-rotation backup.

**The lock is taken by the operation, never by the pipeline.** `executeBackup` and `runBackup` take
no lock, so the pre-restore snapshot and the pre-rotation backup run under the lock their operation
already holds and are never refused. The pipeline runs on the connection pool, so a lock taken
inside it would land on a different session from the operation's and refuse the very backup the
operation needs.

**A held lock is refused, never waited on, and the refusal names the holder.** The lock's session
carries its holder and start time as its `application_name`, which `pg_stat_activity` exposes to the
refused caller; an advisory lock holds no data of its own. The sweep logs the holder and skips the
occurrence. The command, the restore and the rotation exit non-zero saying what holds the lock and
since when. Holder and label are set in one statement with the lock, so a session never holds the
lock unlabelled.

## Consequences

### Positive

- No two backups, and no backup and restore or rotation, overlap, whichever process starts them.
- The internal backups of a restore and a rotation keep their guarantee of never being refused.
- An operator refused at a terminal learns exactly what to wait for.

### Negative

- A manual backup started during a long restore or rotation fails and must be run again.
- A restore or rotation started during a backup is refused rather than queued.
- The holder's label is read from `pg_stat_activity`, so a holder whose session was renamed, or one
  from a build that did not label it, is reported as "another backup, restore or key rotation".

## Alternatives considered

### Waiting on the lock in `pnpm remit:backup`

`pg_advisory_lock` would block until the holder finished. It was rejected: the realistic holders are
a restore and a rotation, each running as long as its archive is large, and an operator or a host
cron entry blocked behind one has no way to tell why the command hangs. A backup that starts the
moment a restore ends also archives a database nobody has checked yet.

### Offering both, with a `--wait` flag

Rejected for the same reason the default refuses, and because nothing yet needs it. A refusal costs
one re-run and says exactly when to make it.

### A lock row in a table

A row would carry the holder directly, but a crashed process would leave it behind, needing expiry
and a reaper. A session lock is released by Postgres the moment its session ends.
