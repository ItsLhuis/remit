# Remit Restore Runbook

Restore is destructive. It replaces the live database contents and the stored files in the public
and documents buckets with the contents of a `.remitbak` archive. Treat every restore as an
incident-response operation, not a routine import.

The archive format is specified in
[`docs/architecture/specs/BACKUP-ARCHIVE.md`](../architecture/specs/BACKUP-ARCHIVE.md). The command
contract is specified in
[`docs/architecture/operations/CLI-CONTRACT.md`](../architecture/operations/CLI-CONTRACT.md).

## Destructive warning

`remit:restore` is an in-container operational command. It may restore either:

- A local archive path visible to the app container.
- A remote archive URI in the form `remit://<destination>/<key>` for configured S3-compatible
  destinations.

Restore does not merge. It replaces. Stored files that exist in the public or documents bucket but
not in the archive are deleted as part of the restore. The exports bucket is not archived and is
left as it is, and so are backup archives a remote destination wrote under `remit-backups/` into a
storage bucket.

The public and documents buckets must hold Remit's files and nothing else. A restore cannot tell a
file another program put there from a stored file the archive predates, and deletes both. The only
objects it leaves are the ones no backup could have carried: the `remit-backups/` archives above,
and objects under keys Remit never writes, such as the empty "folder" markers a provider's console
creates.

## Pre-restore snapshot

Before applying any destructive change, `remit:restore` creates a local snapshot of the current
instance using the same archive writer as `remit:backup`.

The pre-restore snapshot:

- Always writes to the local destination, regardless of the configured backup destination.
- Uses the filename suffix `.pre-restore.remitbak`.
- Is printed to the operator before the destructive step begins.
- Must complete successfully before restore can continue.

The snapshot carries the stored files too, so it needs as much space as any backup of the instance.
If it cannot be created because disk is full, the database is unreachable, the encryption key is
invalid, or the object store cannot be read, restore aborts before touching live data.

## Disk space

A restore needs free space under `REMIT_DATA_DIR` for three things at once: the archive (a remote
archive is downloaded first), the pre-restore snapshot, and the archive's files staged for
verification. Budget roughly three times the size of the instance's files plus its database.

## Confirmation requirements

Interactive restore requires typed confirmation of:

- The database name.
- The pre-restore snapshot path.

There are no default-yes prompts. Non-interactive restore requires both:

- The `--yes` flag.
- `REMIT_ALLOW_UNATTENDED_RESTORE=1` in the environment.

That double opt-in is intentional. A script must make unattended destructive restore explicit in
both command arguments and environment.

An archive from an older schema migration needs one more acknowledgement, described under
[Schema migrations](#schema-migrations).

## Refusal rules

Restore refuses with exit code 1 and takes no destructive action when:

1. `archiveFormatVersion` is greater than the highest version the running build supports.
2. The archive's `encryption.keyFingerprint` does not match the live `REMIT_ENCRYPTION_KEY`
   fingerprint.
3. The archive's `appVersion` is newer than the running `appVersion`.
4. The plaintext header magic, reserved bytes, or algorithm field do not match the archive spec.
5. The decrypted manifest's `archiveFormatVersion` does not match the plaintext header.
6. Any file's SHA-256 in `checksums.sha256` fails verification.
7. An archived path does not name the public or documents bucket, or is not a key a backup writes:
   empty, absolute, with an empty, `.` or `..` segment, a backslash or a control character.
8. The archive's `schemaMigrationId` is not in the running build's migration journal, which means it
   was written by a newer build or another fork. A dry run refuses it too.
9. The archive is from an older schema migration and the run is unattended without
   `--accept-older-schema`.
10. Another backup, restore or key rotation holds the backup lock. The message names it and when it
    started; nothing is written, not even the pre-restore snapshot.

## Schema migrations

Restore compares the archive's `schemaMigrationId` with the last migration in the running build's
journal, and a dry run prints the comparison:

- **The same migration:** restore proceeds.
- **An older migration:** restore warns, naming both migrations, that the restored database will be
  migrated forward to this build's schema and that only the pre-restore snapshot undoes it. An
  interactive run asks for confirmation; declining exits 0 having changed nothing. An unattended run
  refuses unless `--accept-older-schema` is passed. After the database is restored, migrations are
  applied forward through the same compiled entrypoint used on container start.
- **A migration this build does not know:** refused, because migrations only run forwards. Upgrade
  to the build that wrote the archive, then restore.

## Concurrency

Restore holds the backup lock from before its pre-restore snapshot until it exits, so no scheduled
or manual backup and no key rotation can start while it writes files, swaps the database and deletes
stale files ([ADR-0047](../architecture/adr/0047-one-backup-lock.md)). Its own pre-restore snapshot
runs under that lock and is never refused.

## Order of the destructive steps

S3 has no atomic swap, so restore orders its steps so that every point it can stop at leaves an
instance a re-run repairs:

1. Every archived file is written into its bucket, read back, and its SHA-256 compared with the
   archive's. Nothing is deleted.
2. The database is replaced in one transaction.
3. Forward migrations are applied and the pre-restore audit entries replayed.
4. Stored files the archive does not contain are deleted from the public and documents buckets.

A failure in step 1 leaves the old database with every file it names. A failure in step 2 rolls the
database back, over a store that holds the files of both states. A failure in step 3 or 4 leaves the
restored database with every file it names and some it does not; the deletions come last because
they are one request per file and the step most likely to fail, and by then the database is already
migrated and carries its audit trail. In every case, running the same restore again completes it;
the pre-restore snapshot remains the way back to the state before the first attempt.

Between steps 1 and 4 the store holds files of both states. No backup can archive that window: the
restore holds the backup lock throughout, so a scheduled backup that falls due skips its occurrence
and a manual one is refused ([Concurrency](#concurrency)).

## Database and file effects

Database restore uses:

```text
pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --dbname=postgresql://
```

The target database reaches `pg_restore` through the `PG*` environment variables derived from
`DATABASE_URL`, which the empty connection URI takes every part from, so no credential is on its
command line.

The restore runs against the live database and drops and recreates objects from the dump. Settings
rows containing encrypted columns remain valid after restore because the encryption key fingerprint
has already been verified.

Every file goes back into the bucket its archive path names, under its original key and content
type, so an archive restores into an instance whose `S3_BUCKET` differs from the one that wrote it.

## Logging and redaction

Restore uses operator-facing CLI output plus audit events. Failure reasons are redacted before they
are printed or persisted in audit metadata.

The following must never appear in operator output or audit metadata:

- Raw AES keys.
- Typed confirmation input.
- Password hashes from `accounts`.
- Decrypted values from encrypted columns.
- Archive byte contents.
- Full manifest JSON when it contains encrypted credential ciphertext such as
  `settings.backup_s3_*`.

`remit:restore` writes these audit events when not running in dry-run mode:

- `instance.restore.started` - `operationId`, `archiveAppVersion`, `archivePath`, and
  `schemaMigrationId`.
- `instance.restore.snapshot_taken` - `operationId`, `archivePath`, and `snapshotPath`.
- `instance.restore.completed` - `operationId`, `archiveAppVersion`, `archivePath`, and
  `snapshotPath`.
- `instance.restore.aborted` - `operationId`, `archivePath`, redacted `reason`, and `snapshotPath`
  when available.

Pre-restore audit entries are replayed after the database dump replaces the live database so the
restored audit log retains the operation trail.

## Operator-facing notes

- Verify that you have the correct `.remitbak` archive and the correct `REMIT_ENCRYPTION_KEY` before
  starting.
- Prefer restoring from the newest known-good backup unless rollback instructions specify a
  pre-upgrade snapshot.
- For remote archives, confirm the configured S3, R2, or B2 destination is reachable before starting
  restore.
- Keep the printed pre-restore snapshot path. It is the rollback point for the state that existed
  immediately before this restore attempt.
- If restore refuses because the archive is newer than the running app version, upgrade the app
  first rather than forcing a downgrade restore.
