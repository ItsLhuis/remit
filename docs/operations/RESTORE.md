# Remit Restore Runbook

Restore is destructive. It replaces the live database contents and the live uploads directory with
the contents of a `.remitbak` archive. Treat every restore as an incident-response operation, not a
routine import.

The archive format is specified in
[`docs/architecture/specs/BACKUP-ARCHIVE.md`](../architecture/specs/BACKUP-ARCHIVE.md). The command
contract is specified in
[`docs/architecture/operations/CLI-CONTRACT.md`](../architecture/operations/CLI-CONTRACT.md).

## Destructive warning

`remit:restore` is an in-container operational command. It may restore either:

- A local archive path visible to the app container.
- A remote archive URI in the form `remit://<destination>/<key>` for configured S3-compatible
  destinations.

Restore does not merge. It replaces. Files that exist in the live uploads directory but not in the
archive are deleted as part of the restore.

## Pre-restore snapshot

Before applying any destructive change, `remit:restore` creates a local snapshot of the current
instance using the same archive writer as `remit:backup`.

The pre-restore snapshot:

- Always writes to the local destination, regardless of the configured backup destination.
- Uses the filename suffix `.pre-restore.remitbak`.
- Is printed to the operator before the destructive step begins.
- Must complete successfully before restore can continue.

If the snapshot cannot be created because disk is full, the database is unreachable, the encryption
key is invalid, or the uploads volume cannot be read, restore aborts before touching live data.

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

Restore warns but proceeds after typed confirmation when the archive's `schemaMigrationId` is older
than the current migration head. After restore completes, migrations are applied forward through the
same entrypoint path used on container start.

## Upload and database effects

Database restore uses:

```text
pg_restore --clean --if-exists --no-owner --no-privileges
```

The restore runs against the live database and drops and recreates objects from the dump. Settings
rows containing encrypted columns remain valid after restore because the encryption key fingerprint
has already been verified.

Uploads restore replaces the live uploads directory with the archive contents. The replacement is
atomic from the operator's perspective: either the archive contents become live, or restore fails
and reports the failure. Files absent from the archive are removed from the live uploads tree.

## Logging and redaction

Restore logs through `pino` following `.agents/rules/errors.md`.

The following must never appear in logs:

- Raw AES keys.
- Typed confirmation input.
- Password hashes from `accounts`.
- Decrypted values from encrypted columns.
- Archive byte contents.
- Full manifest JSON when it contains encrypted credential ciphertext such as
  `settings.backup_s3_*`.

`remit:restore` writes an `audit_log` entry before the destructive step begins with:

```json
{
  "archivePath": "<path-or-uri>",
  "archiveAppVersion": "<version>",
  "snapshotPath": "<local-pre-restore-snapshot>"
}
```

It writes a second audit entry on completion or abort.

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
