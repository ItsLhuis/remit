# DR-0042 — Backup policy settings surface

- **Status:** Shipped
- **Date:** 2026-09-09
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0005, ADR-0014, ADR-0019, ADR-0020
- **Supersedes:** —

## What

`/settings/backup` gives the fifteen `settings.backup_*` columns an owner-only user interface, so a
self-hoster configures where backups go without writing SQL.

## Why

The backup machinery was complete and unreachable. `remit:backup` read a destination, a bucket, a
region, an endpoint, two AES-256-GCM credentials and three retention counts that nothing in the
application ever wrote: an operator either took the defaults or issued an `UPDATE` against their own
database. For the two encrypted columns that was worse than inconvenient — a hand-written `UPDATE`
stores plaintext where `encryptedColumn()` expects ciphertext, so the credential is silently corrupt
and the failure surfaces at the next backup rather than at the moment of the mistake.

`docs/architecture/ARCHITECTURE.md` placed backup policy in `/settings/**` in two separate sections,
and `PRODUCT.md`'s fifth design principle says self-hosting surfaces are designed with the same care
as the invoice screen. Backups were the one place both were untrue.

## Scope

Included: the destination and its four S3-compatible fields, the two encrypted credentials, the
cadence, the three retention counts, a destination test, the last-run status, the hosted-mode
affordance, and the audit entry every save writes.

Excluded, with reasons:

- **A scheduler.** `backup_cadence` is stored and consumed by nothing. Building the schedule here
  would have folded a second capability into this one; the page says plainly that nothing runs a
  backup automatically and names the command that does.
- **Multi-destination fan-out.** `docs/architecture/specs/BACKUP-ARCHIVE.md` defers it and the
  command writes one destination per invocation, so offering two would describe a product that does
  not exist.
- **A local path field.** The local destination writes under `REMIT_DATA_DIR`, which is
  deployment-owned configuration and belongs in `.env` by the boundary in ARCHITECTURE.md section
  13, not in a settings row.
- **A `settings` check constraint on the retention counts.** The bound is a form-level judgement
  about a sensible policy, not a domain invariant; the retention algorithm already normalizes any
  value it is handed.
- **Changes to the backup command, the archive format, or the retention algorithm.** The surface
  writes the columns those already read.

## How

The module follows `features/settings/payment` because it has the same shape — encrypted credentials
plus a connection test — and `features/settings/email` for the provider switch, where a different
set of fields is required per choice.

Three parts carry the weight:

**Credentials are write-only, not masked.** `toBackupSettingsFormData` returns `""` for both
credentials beside a `*Configured` boolean, and the write plan sets a credential column only when
the submission carries a non-empty value. Masking, which `payment` uses for the IBAN, was rejected:
an IBAN is recognisable to its owner from four characters and an access key is not, so a mask would
leak key material to buy nothing. The pair is a single contract — the read model never sends a
secret, so a blank submission has to mean "keep what is stored", and reading it as a clear would
wipe an operator's credentials on the first save of the form.

**Per-destination requirements live once.** `services/destinationRequirements.ts` is the field-level
twin of `validateBackupCredentials`, which is the gate the backup command itself runs. The command's
gate reports one reason for a whole destination and a form needs to know which box to put the
message on, so the two are separate functions — and a test drives every combination of bucket,
region, endpoint and both credentials through both, because a destination the form calls complete
and the command then refuses is a configuration an operator saved believing it worked.

**The test writes.** Listing a bucket proves read access; a backup needs to write, and retention
needs to delete. `connectionTest.ts` puts one small object and deletes it, and reports failure if
either half fails. Its key sits under `remit-connection-test/`, deliberately outside the
`remit-backups/` prefix `enforceRemoteRetention` lists and prunes: a probe under that prefix would
be treated as an archive, and one written today would hold the newest daily slot and let a real
archive be deleted in its place.

Hosted mode is the one reader `REMIT_HOSTED_MODE` has ever had. The form renders read-only and says
the operator manages backups, and the write gate refuses independently, because a read-only form is
a rendering decision and never the authorization.

## Evidence

- Module: `features/settings/backup/` — `schemas.ts`, `queries.ts`, `mutations.ts`,
  `connectionTest.ts`, `services/destinationRequirements.ts`, `components/BackupSettingsPage/`.
- Route: `app/(dashboard)/settings/backup/page.tsx`, `requireRole("owner")`; the rail entry in
  `components/layout/SettingsSidebar.tsx` is visibility only.
- Credential preservation: `buildBackupSettingsWritePlan` in `features/settings/backup/mutations.ts`
  writes a credential column only inside the `if (backupS3AccessKey && …)` guard; proven by "keeps
  stored credentials when a save leaves their fields untouched" in
  `features/settings/backup/__tests__/mutations.integration.test.ts`.
- Read model omission: `toBackupSettingsFormData` in `features/settings/backup/queries.ts`.
- Requirement agreement:
  `features/settings/backup/services/__tests__/destinationRequirements.test.ts` drives every
  credential combination through `getMissingBackupCredentialFields` and `validateBackupCredentials`
  in `lib/backups/destinationConfig.ts`.
- Retention semantics the copy describes: `computeRetentionDeletions` in
  `scripts/core/backup/retention.ts`; its remote-only application is `enforceRemoteRetention` in
  `scripts/core/backup/writeArchive.ts`, called from `runBackup.ts` only when
  `plan.destination !== "local"`.
- Audit: `writeBackupSettingsAudit` writes `settings.backup.updated` with `changedFields` and
  `secretFieldsChanged` and no values.
- Redaction: the connection-test log line passes the provider message through
  `redactOperationalError` in `scripts/core/cli/redact.ts`.
- Schema: `backup_test_connection_at` in `database/schema/settings.ts`, migration
  `drizzle/migrations/0008_gifted_black_panther.sql`, excluded from exports as `configuration` in
  `features/dataExport/services/exportInstanceTables.ts`, documented in
  `docs/architecture/SCHEMA.md` section 7.

## Verification

`pnpm typecheck`, `pnpm lint` (no new burn-down warnings), `pnpm test` (2211 tests),
`pnpm test:integration` (791 tests) and `pnpm build` all pass. react-doctor and fallow report
nothing against this module; the duplicate `BackupDestination` union fallow found was removed by
importing the storage adapter's type instead of restating it. `pnpm database:generate` reports no
further schema changes after the migration was applied to the test database.

A throwaway integration check was run against the running MinIO and then deleted rather than
committed, because it needs operator-chosen credentials that must not enter the repository. It drove
the real `saveBackupSettings`, then read the row back through the backup command's own
`readBackupCredentialsFromSettings` and `buildConfiguredDestinationAdapter`, and put, listed and
deleted a real object: the command reads exactly what the surface writes, through the encrypted
columns, end to end. The same run verified the destination test against real MinIO, a wrong secret
producing a translated refusal with no provider text and no secret in the log line, a retention-only
save leaving the credentials usable, and the local destination proving the data directory writable.

Not verified: a real `pnpm remit:backup` or `pnpm remit:restore` run. Neither is available in this
environment — `pg_dump` exists only inside the Postgres container and no application container is
running — and restore is destructive to a live instance, so it was not attempted. The claim that the
command consumes this configuration rests on the adapter-level check above rather than on a
completed archive.

Hosted-mode read-only rendering, the absence of the action buttons, the destination switch, the
blank credential fields and accessibility are covered by
`features/settings/backup/components/BackupSettingsPage/__tests__/BackupSettingsForm.test.tsx`,
including `vitest-axe`. Role refusal is covered in the integration suite. No browser session was
driven against the page, so keyboard-only completion and the non-owner `notFound()` are asserted at
the component and mutation level rather than end to end.

## Known gaps

- Nothing schedules a backup. `backup_cadence` is configurable and inert until a scheduler consumes
  it.
- Retention is enforced only for remote destinations. Local archives accumulate until an operator
  removes them; the page says so, and closing it means changing the command, not this surface.
- The local destination test leaves an empty `remit-connection-test` directory beside the archives.
  The adapter deletes the probe file and not its parent, and the directory is created once.
- The destination test proves write and delete on one small object. It does not prove the bucket has
  room for an archive, that a lifecycle policy will not expire one, or that a multipart upload of a
  large archive will succeed.
- No end-to-end test drives the page and then runs a backup. The two halves are verified separately.
