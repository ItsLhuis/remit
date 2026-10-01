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

Restore records the archive's `schemaMigrationId` for audit entries and dry-run visibility. It does
not compare that value with the current migration head or implement a separate older-than-current
migration warning gate. After restore completes, migrations are applied forward through the same
compiled entrypoint path used on container start.

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

Between steps 1 and 4 the store holds files of both states. A scheduled backup that ran in that
window would archive them; stop the worker (`docker compose stop worker`) for the length of a
restore if a scheduled backup is due.

## Database and file effects

Database restore uses:

```text
pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --dbname <DATABASE_URL>
```

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
