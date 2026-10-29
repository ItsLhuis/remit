# Remit Backup Runbook

Remit backs itself up every night when the owner has set that up, and an operator can back up by
hand at any time. This runbook says what a backup is, when the worker takes one, how Remit tells you
when it has not, and how to prove an archive restores before you need it. Restoring is in
[`RESTORE.md`](RESTORE.md).

## What a backup is

A backup is one encrypted `.remitbak` file. It holds a `pg_dump --format=custom` dump of the
database, every object of the public and documents buckets, a `manifest.json` and a
`checksums.sha256`, inside an AES-256-GCM encrypted gzip tar behind a fixed plaintext header
(`scripts/core/backup/executeBackup.ts`, `scripts/core/backup/writeArchive.ts`,
`scripts/core/backup/databaseDump.ts`). Each object is recorded under its bucket's role, so an
archive restores into an instance whose `S3_BUCKET` differs. The exports bucket is not archived
(`lib/storage/bucketNames.ts`).

The archive is encrypted with `REMIT_ENCRYPTION_KEY`. Without that key the archive cannot be read
and a restore refuses it (`scripts/core/restore/runRestore.ts`), so the key must be stored somewhere
other than the host the backups protect. The byte layout is in
[`scripts/core/archive/header.ts`](../../scripts/core/archive/header.ts).

An archive lives at one of two places, set on `/settings/backup`:

- The local destination writes `remit-backup-<UTC timestamp>-v<app version>.remitbak` into
  `backups/` under `REMIT_DATA_DIR`. In the stock Compose file that is `./data/backups` on the host
  (`docker-compose.yml`, `scripts/core/backup/filename.ts`).
- An S3-compatible destination (`s3`, `r2` or `b2`) uploads the same file to
  `remit-backups/<year>/<month>/` in the bucket you configured (`scripts/core/backup/filename.ts`).

## When the worker takes a backup

The `worker` container registers the job `backup.run.sweep` on a fixed schedule, `0 0 1 * * *` in
UTC, which is 01:00 UTC every night (`lib/jobs/schedules.ts`). The hour is ahead of
`retention.purge.sweep` at 02:30, so the newest archive still holds the rows that purge destroys.
Without a running worker no scheduled backup is taken.

The schedule never changes. The owner's cadence, `daily` or `weekly` on `/settings/backup`, decides
at run time whether tonight is a backup night (`features/backups/jobs.ts`,
`features/backups/services/backupSchedule.ts`). Tonight is a backup night when no backup has ever
succeeded, or when the last success is at least the cadence interval (one day, or seven) minus four
hours old; the four hours absorb the time a run takes to finish. A weekly instance therefore backs
up about every seventh night, and changing the cadence needs no restart.

The sweep does nothing, and takes no archive, when:

- the instance is hosted (`REMIT_HOSTED_MODE`, see below);
- no settings row exists yet, because `/setup` has not run;
- tonight is not a backup night under the cadence;
- an encryption key rotation is running, in which case the next night takes the archive;
- another backup, restore or key rotation holds the backup lock.

The skips for a rotation and a held lock write a warning to the worker log. A failed backup is
recorded and not retried that night: the sweep stores the reason in
`settings.backup_last_failure_at` and `settings.backup_last_failure_reason`, writes an
`instance.backup.failed` audit entry, and ends as completed, so the job metrics do not show it
(`features/backups/jobs.ts`, `scripts/core/backup/executeBackup.ts`). A success clears the failure
and writes `instance.backup.completed`. The audit entry's user agent is `worker/backup` for a
scheduled run, which tells it apart from an operator's run.

## The backup lock

One PostgreSQL session advisory lock guards every operation that writes an archive or swaps data
(`lib/backups/backupLock.ts`). These take it for their whole run:

- the scheduled sweep;
- `pnpm remit:backup` (`scripts/core/backup/runBackup.ts`);
- `pnpm remit:restore` (`scripts/core/restore/runRestore.ts`);
- `pnpm remit:rotate-encryption-key` (`scripts/core/keyRotation/runRotation.ts`).

A restore and a rotation each take a backup of their own on the way, the pre-restore snapshot and
the pre-rotation backup. That backup runs under the lock its operation already holds and does not
take it again. A second holder is refused, never queued: `remit:backup`, `remit:restore` and
`remit:rotate-encryption-key` exit with an error that names the holder and when it started, and the
sweep skips that night. A process that dies releases the lock with its database session, so a crash
leaves nothing to clean up. A rotation also holds its own separate lock, which the sweep checks
before it starts (`scripts/core/keyRotation/lock.ts`).

## The backup destination and its test

`/settings/backup` is open to the owner role. It sets the destination, the bucket, region and
endpoint of an S3-compatible target, its access key and secret key, the cadence and the three
retention counts. The two credentials are encrypted columns and are never sent back to the browser;
leaving their fields blank keeps the stored values (`features/settings/backup/mutations.ts`,
`features/settings/backup/queries.ts`).

The page's connection test checks that a backup can actually be written. It uploads one small object
named `remit-connection-test/<uuid>.probe` and deletes it, because a successful listing would prove
the bucket can be read and nothing about writing or pruning. The prefix sits outside
`remit-backups/`, which retention prunes. When both steps work, the time is stored in
`backup_test_connection_at`. A failure shows a translated message, with the provider's own text
reaching the log only after redaction. If the object is written but cannot be deleted, the test
fails and the probe object stays in the bucket for you to remove
(`features/settings/backup/connectionTest.ts`, `features/settings/backup/mutations.ts`).

Run the test once after saving a remote destination and again whenever its credentials change. It
does not test restoring; see "Testing a backup" below.

## Hosted mode

With `REMIT_HOSTED_MODE` set to `true` or `1` (`lib/config/envSchema.ts`), the backup destination
belongs to whoever operates the instance. On such an instance:

- `/settings/backup` renders read-only;
- saving the settings and running the connection test are refused on the server
  (`features/settings/backup/mutations.ts`);
- the scheduled sweep does nothing (`features/backups/jobs.ts`);
- the dashboard banner is not shown (`features/backups/queries.ts`).

The operator can still run `pnpm remit:backup` against the instance at any time the lock is free.

## Retention

After each archive is written, Remit deletes older archives that the retention counts do not keep:
the counts are `backup_retention_daily`, `backup_retention_weekly` and `backup_retention_monthly`,
defaulting to 7, 4 and 12, each 0 to 365 (`database/schema/settings.ts`,
`features/settings/backup/schemas.ts`). The rule (`scripts/core/backup/retention.ts`) runs over
three age windows, using UTC dates and ISO weeks:

- the most recent `daily` days keep the newest archive of each calendar day;
- the next `weekly` weeks keep the newest archive of each ISO week;
- everything older keeps the newest archive of each calendar month, up to `monthly` of them.

It prunes the remote destination under `remit-backups/`, or the local `backups/` directory,
whichever the run wrote to. It never deletes the archive just written, even when every count is 0.
It also never touches a pre-restore snapshot (`*.pre-restore.remitbak`), a pre-rotation backup
(`*.pre-key-rotation.remitbak`) or an archive written with `--output`, because local retention
selects only files named exactly as a scheduled or default manual backup names them
(`scripts/core/backup/filename.ts`, `scripts/core/backup/writeArchive.ts`). Those files are yours to
delete. If pruning fails, the run still counts as a success and a warning is printed.

## How Remit tells you a backup is missing

The dashboard shows the owner a banner, and no other role, when (`features/backups/queries.ts`,
`features/backups/services/backupSchedule.ts`, `app/(dashboard)/DashboardBackupBanner.tsx`):

- the last recorded outcome was a failure, which outranks the other states because it names the
  cause;
- no backup has ever succeeded;
- the newest success is older than the cadence interval plus one day, which is two nights for a
  daily instance and eight days for a weekly one.

The banner has no dismiss button; it clears when a backup succeeds. Because it reads the absence of
a recent success, a worker that never started raises it just as a failed backup does.

`/settings/system` shows the last success, the last failure and the destination, and marks the
backup check as needing attention when no backup exists or the newest is older than seven days
whatever the cadence (`features/health/queries.ts`). The metrics endpoint does not tell you whether
an archive was written: `backup.run.sweep` completes every night, including nights it takes nothing
([`METRICS.md`](METRICS.md)).

## Backing up by hand

```bash
docker compose exec app pnpm remit:backup
```

The command uses the configured destination, takes the lock, and records the same status and audit
entries as the sweep. `--yes` skips the prompt that asks before an existing local file is
overwritten, `--dry-run` prints the plan without writing, `--destination local|s3|r2|b2` overrides
the destination for one run, and `--output <path>` writes a local archive to that path, which
retention then leaves alone (`scripts/core/backup/args.ts`). `scripts/host/upgrade.sh` runs this
command before every upgrade, unless `--skip-backup` is passed together with
`REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP=1`.

## Testing a backup

A backup you have never restored is a hope. The tests below tell you three different things, and the
last is the only one that proves recovery.

### Check that an archive is intact

Run a dry-run restore against the archive in the instance's own app container. It decrypts the
archive with the live key, checks the header and every checksum, and prints what the archive holds.
It writes no snapshot, no audit entry, no database change and no file to the stores
(`scripts/core/restore/runRestore.ts`, `scripts/core/restore/dryRunSummary.ts`).

```bash
docker compose exec app pnpm remit:restore --dry-run /app/data/backups/<archive>.remitbak
```

The output names the archive's creation time, app version, schema migration, database dump size, and
the file count and size for the public and documents buckets. Check that the creation time is the
one you expect and that the file counts are plausible. The command fails when the key does not
match, when a checksum fails, or when the archive comes from a newer app version or an unknown
migration.

### Restore it into a scratch instance and compare

A dry run cannot show that the data inside is usable. Restoring does, and a restore overwrites the
database and the files of the instance it runs in, so run it only in a separate scratch instance
that shares nothing with production. The steps below use a second Compose project on the same host.
Do not run a restore against your live instance to test it.

1. Create `.env.scratch` in the checkout (the `.gitignore` entry for `.env.*` keeps it out of git)
   from a copy of `.env` with these values changed:

   ```bash
   PORT=3100
   REMIT_APP_BIND=127.0.0.1
   REMIT_PUBLIC_URL=http://localhost:3100
   REMIT_DATA_DIR=/srv/remit-scratch-data
   COMPOSE_PROFILES=
   S3_ENDPOINT=http://storage:9000
   S3_FORCE_PATH_STYLE=true
   REMIT_METRICS_TOKEN=
   SENTRY_DSN=
   ```

   Keep `REMIT_ENCRYPTION_KEY` exactly as production has it, because a restore refuses an archive
   whose key fingerprint differs. The S3 endpoint must be the scratch project's own bundled store,
   even when production uses an external bucket: a restore deletes every stored file in the public
   and documents buckets that the archive does not hold, in whatever store the environment names
   ([`RESTORE.md`](RESTORE.md)).

2. Start only the database, Redis, the object store and the app. Leave the worker out, so the
   scratch copy of your data never runs reminders, emails or webhooks:

   ```bash
   docker compose -p remit-scratch --env-file .env.scratch run --rm --no-deps --user root --entrypoint chown app nextjs:nodejs /app/data
   docker compose -p remit-scratch --env-file .env.scratch up -d database redis storage app
   ```

   The `-p remit-scratch` project name gives the scratch instance its own volumes. The first command
   lets the app's user write to the data directory, as in [`INSTALL.md`](INSTALL.md). Wait for
   `docker compose -p remit-scratch --env-file .env.scratch ps` to show `app` healthy.

3. Put a copy of the archive into the scratch app container. For a local destination the archive is
   in `./data/backups`; for a remote one, download the object with your provider's tools first,
   because the scratch instance has no backup credentials of its own to fetch it with:

   ```bash
   docker compose -p remit-scratch --env-file .env.scratch cp ./data/backups/<archive>.remitbak app:/tmp/test.remitbak
   ```

4. Restore it. The scratch database holds only the empty schema, so nothing of value is replaced:

   ```bash
   docker compose -p remit-scratch --env-file .env.scratch exec app pnpm remit:restore /tmp/test.remitbak
   ```

   The command asks you to type the database name and the pre-restore snapshot path. It prints the
   archive it restored and exits 0. If it refuses, the message names the reason
   ([`RESTORE.md`](RESTORE.md) lists them).

5. Compare what came back with what you expect. Counts of the main tables should equal those in
   production as of the archive's creation time:

   ```bash
   docker compose -p remit-scratch --env-file .env.scratch exec database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT (SELECT count(*) FROM clients) AS clients, (SELECT count(*) FROM invoices) AS invoices, (SELECT count(*) FROM uploads) AS uploads"'
   ```

   Run the same query against production (`docker compose exec database ...`). Counts differ by
   whatever changed after the archive was taken, so compare against a quiet moment or the same
   instant. Then open `http://localhost:3100`, sign in with a production account, and open an
   invoice and a stored file such as a logo. Signing in proves the encrypted columns decrypt with
   the key, and a file that opens proves the object store was restored.

6. Remove the scratch instance and its copy of your data:

   ```bash
   docker compose -p remit-scratch --env-file .env.scratch down -v
   sudo rm -rf /srv/remit-scratch-data
   rm -f .env.scratch
   ```

   `-v` removes only the volumes of the `remit-scratch` project. `sudo` is needed because step 2
   changed the owner of the data directory to the app's user.

Repeat the scratch restore after changing the encryption key, the object storage or the backup
destination, and on a schedule you will keep, because it is the only step in this runbook that fails
when an archive you are counting on is unusable.

## Execution

What automation runs:

- The cadence and banner rules: `features/backups/services/__tests__/backupSchedule.test.ts` and
  `features/backups/components/__tests__/BackupStatusBanner.test.tsx`.
- The scheduled sweep through a real queue:
  `features/backups/__tests__/scheduledBackup.integration.test.ts` checks that it writes an archive
  and records success, writes no second archive inside the cadence, writes none while a restore or a
  manual backup holds the lock, and records a failure with no credential for a misconfigured
  destination. `tests/e2e/scheduledBackup.spec.ts` drives the same flow through the production
  worker process and reads "Last successful backup" on `/settings/backup`. The dashboard banner is
  covered only by the unit test above.
- The backup command and the lock: `scripts/core/backup/__tests__/` covers a decryptable local
  archive, a remote upload to an in-process S3 test server with retention, a failed upload keeping
  the previous success time, local and remote retention, and refusal while the lock is held.
- Restore: `scripts/core/restore/__tests__/restore.integration.test.ts` restores local and remote
  archives, every stored file byte for byte, and checks the refusals listed in
  [`RESTORE.md`](RESTORE.md).
- The settings page: `features/settings/backup/__tests__/mutations.integration.test.ts` covers
  credential handling, the audit entry, the refusal of a non-owner and of a hosted instance, with
  the connection test itself mocked; `tests/e2e/backupSettings.spec.ts` configures a local backup,
  takes one and shows it as the last success.
- `.github/workflows/install.yml` runs `pnpm remit:backup --yes` once in the installed stack, which
  checks that a backup can be written into the data directory.

What is not executed by any automation:

- A real S3, R2 or B2 bucket. The remote tests use an in-process test server, and the connection
  test is never run against a provider.
- The connection test (`features/settings/backup/connectionTest.ts`) by any test of its own.
- The sweep on a hosted instance, and the sweep standing down for a key rotation.
- Restoring a real archive into a second Compose project, which is the "Testing a backup" procedure
  above. It is written from the commands in `package.json` and `docker-compose.yml`, and no
  automated run or recorded manual run has followed it.
