# DR-0026: Encrypted backup and remote destinations

- **Status:** Shipped
- **Date:** 2026-05-23
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0019, ADR-0020
- **Supersedes:** —
- **Reconstructed:** yes

## What

`pnpm remit:backup`, which writes an AES-256-GCM encrypted `.remitbak` archive of the database and
uploads to a local path or to an S3-compatible destination, and applies a retention policy.

## Why

A self-hosted product moves the responsibility for not losing everything onto the person least
equipped to carry it. Telling an operator to run `pg_dump` themselves misses the uploads volume, the
encryption key fingerprint and the archive integrity, and produces a plaintext file containing every
client's details. The backup has to be one command that produces one file that is safe to store
anywhere.

## Scope

Included: a `pg_dump --format=custom` of the database and the uploads directory, packed as a
gzip-compressed tar, encrypted with AES-256-GCM under the instance key; a plaintext header carrying
the format version, IV and key fingerprint; a manifest and SHA-256 checksums inside the payload;
local, S3, R2 and Backblaze B2 destinations through the S3-compatible adapter;
grandfather-father-son retention; success and failure status written back to settings; and audit
entries for both outcomes.

Excluded: scheduling. This is a command an operator or a wrapper runs; nothing in the product runs
it on a cadence. Also excluded: incremental or differential backups — a full archive is restorable
without a chain, and a chain is the thing that breaks silently.

## How

The archive format is specified in `docs/architecture/specs/BACKUP-ARCHIVE.md` rather than being
implicit in the writer, because a format read by a restore that may be years newer needs a contract
that a change has to be measured against. Breaking it requires bumping `archiveFormatVersion` and
recording a later ADR.

The header is deliberately **not** authenticated by GCM. It carries no secret and exists only so a
restore can identify the format and check the key fingerprint before attempting decryption — telling
an operator "wrong key" is far better than a decryption failure. Restore re-validates it against the
manifest after decryption, so the unauthenticated header cannot be trusted into the payload.

Retention runs three consecutive age windows — daily, then weekly, then monthly — over one shared
`kept` set, so an archive retained by an earlier tier does not also consume a slot in a later one.
The returned list is treated as authoritative by the callers, which is why the function carries a
comment saying that narrowing a window here deletes backups.

Remote credentials are read from the encrypted settings columns rather than from the environment, so
the destination is instance configuration rather than deployment configuration.

## Evidence

- `scripts/backup.ts`, `scripts/core/backup/` — `runBackup.ts`, `writeArchive.ts`,
  `databaseDump.ts`, `uploads.ts`, `manifest.ts`, `retention.ts`, `plan.ts`, `credentials.ts`,
  `statusUpdate.ts`, `filename.ts`, `args.ts`
- `scripts/core/archive/header.ts`, `scripts/core/archive/tar.ts`, `scripts/core/destination/`
- `docs/architecture/specs/BACKUP-ARCHIVE.md`
- `docs/architecture/operations/CLI-CONTRACT.md` — the `pnpm remit:backup` section
- `database/schema/settings.ts` — `backup_destination`, the retention columns, the encrypted S3
  credentials and the last-success/last-failure columns
- `features/health/queries.ts` — the backup health check reading those status columns

## Verification

`scripts/core/backup/__tests__/backup.integration.test.ts` runs the command end to end against the
Dockerized test Postgres and a real uploads directory, producing and reading back an archive.
`retention.test.ts` covers the three-window policy including the shared-`kept` behaviour and the
zero-count edges. `manifest.test.ts` covers manifest construction.
`scripts/core/archive/__tests__/backupArchive.test.ts` covers the header layout and round trip.
`scripts/core/destination/__tests__/destination.test.ts` covers destination resolution.

Not covered by an automated test: a real S3, R2 or Backblaze B2 account. Remote destinations are
verified against the S3-compatible test double and MinIO.

## Known gaps

Backup policy has no settings page: `backup_destination`, `backup_cadence`, the three retention
columns and the five S3 credential columns are settable only by SQL, while
`docs/architecture/operations/CLI-CONTRACT.md` refers an operator to a `/settings/backup` page that
does not exist.

Nothing schedules a backup. `backup_cadence` has no consumer, so the cadence an operator sets by SQL
has no effect.
