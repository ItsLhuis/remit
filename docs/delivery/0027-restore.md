# DR-0027: Restore from an encrypted archive

- **Status:** Shipped
- **Date:** 2026-05-26
- **Verdict:** Complete
- **Decisions:** ADR-0020
- **Supersedes:** —
- **Reconstructed:** yes

## What

`pnpm remit:restore`, which verifies a local or remote `.remitbak` archive, snapshots the live
instance, replaces the database and uploads with the archive contents, and runs forward migrations.

## Why

A backup nobody has restored is a file, not a backup. Restore is also the only operation in the
product that can destroy everything by working exactly as designed, which makes its refusals and
confirmations the deliverable as much as its happy path.

## Scope

Included: local archive paths and `remit://<destination>/<key>` remote references; header and
checksum verification before any destructive step; a mandatory pre-restore snapshot; typed
confirmation of the database name and the snapshot path for interactive runs; a double opt-in for
unattended runs; `pg_restore` inside a single transaction; an atomic uploads swap; forward
migrations after the restore; and audit entries for started, snapshot taken, completed and aborted.

Excluded: merging. Restore replaces, and files present live but absent from the archive are deleted
— stated plainly in the runbook because an operator who expects a merge will lose data. Also
excluded: `--force-version`, partial restore and point-in-time recovery, each of which would turn a
verified-archive operation into a judgement call under pressure.

## How

The pre-restore snapshot uses the same archive writer as the backup command and always writes
locally regardless of the configured destination, because the one moment an operator needs a
rollback is the moment the remote destination may be the thing that is wrong. It must complete
before anything destructive happens: a snapshot that fails on full disk, an unreachable database, an
invalid key or an unreadable uploads volume aborts the restore before live data is touched.

Confirmation is typed rather than yes/no, and there is no default-yes prompt anywhere. The
unattended path requires both `--yes` and `REMIT_ALLOW_UNATTENDED_RESTORE=1`, deliberately in two
different places — a script has to make destructive restore explicit in its arguments _and_ its
environment, so neither alone can enable it by accident.

`pg_restore` runs with `--clean --if-exists --no-owner --no-privileges --single-transaction`, so a
failed restore rolls back rather than leaving a half-replaced database.

The uploads swap is atomic in the only sense a filesystem offers: the archive's uploads are staged
and checksum-verified beside the live directory, then two `rename` calls move the live directory
aside and the staged one into place. A rename within a filesystem is atomic where a recursive copy
is not, so there is no window in which the live directory is half-replaced, and the displaced
directory is kept rather than deleted so the previous uploads survive a failed restore.

Forward migrations run after the restore because the archive may predate the running image, and an
archive restored into a newer application is the ordinary case rather than the exceptional one.

Errors and audit metadata are redacted before they are written, so a failure message cannot carry
key material or credentials into the log.

## Evidence

- `scripts/restore.ts`, `scripts/core/restore/` — `runRestore.ts`, `verifyArchive.ts`,
  `snapshot.ts`, `confirm.ts`, `restoreDump.ts`, `uploadsSwap.ts`, `postRestoreMigrations.ts`,
  `remoteDownload.ts`, `manifestSchema.ts`, `header.ts`, `auditTrail.ts`, `redact.ts`, `errors.ts`,
  `args.ts`
- `docs/operations/RESTORE.md` — the operator runbook
- `docs/architecture/operations/CLI-CONTRACT.md` — the `pnpm remit:restore` section
- `docs/architecture/specs/BACKUP-ARCHIVE.md` — the format it validates against

## Verification

`scripts/core/restore/__tests__/restore.integration.test.ts` runs a full restore against the
Dockerized test Postgres from an archive the backup command produced, including the pre-restore
snapshot and the post-restore migrations. `restoreArchive.test.ts` covers archive verification:
header mismatch, wrong key fingerprint, checksum failure and manifest disagreement each abort before
destructive work. The refusal rules are covered as tests rather than as documentation.

Not covered by an automated test: an operator's interactive typed confirmation, which is exercised
through the non-interactive path with the confirmation function stubbed. Remote downloads are
verified against the S3-compatible test double rather than a real provider.

## Known gaps

Restore records the archive's `schemaMigrationId` for audit and dry-run visibility but implements no
older-than-current warning gate, so restoring an archive from a much older schema is allowed and
relies on forward migrations succeeding.
