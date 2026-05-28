# Backup Archive Format

This document is the implementation-facing specification for Remit's encrypted `.remitbak` archive
format. The architecture overview summarizes the backup model; this file defines the durable archive
contract used by `remit:backup` and `remit:restore`.

ADR-0020 owns the accepted architectural decision. Changes that break a released archive format must
bump `archiveFormatVersion` and be recorded in a later ADR.

## Archive filename convention

Every backup is a single binary file:

```text
remit-backup-<YYYYMMDDTHHMMSSZ>-v<appVersion>.remitbak
```

The `.remitbak` extension is recognizable, unambiguous, and discourages accidental opening with
unrelated tools. Operators should not gzip the file externally; the payload is already compressed
inside the encrypted body.

## Byte layout

```text
+----------------------------------------------------------+
| Plaintext header (fixed, 64 bytes)                       |
|   offset 0   : magic "REMIT-BAK\0"           (10 bytes)  |
|   offset 10  : archiveFormatVersion (uint16 BE) (2)      |
|   offset 12  : encryptionAlgorithm (uint8)   (1)         |
|                   0x01 = AES-256-GCM                     |
|   offset 13  : reserved, must be 0           (3 bytes)   |
|   offset 16  : iv                            (12 bytes)  |
|   offset 28  : keyFingerprint (first 16 bytes of         |
|                  SHA-256 of the AES key)     (16 bytes)  |
|   offset 44  : reserved, must be 0           (20 bytes)  |
+----------------------------------------------------------+
| Ciphertext body (AES-256-GCM)                            |
|   The plaintext, after decryption, is a gzip-compressed  |
|   tar stream with the layout described below.            |
+----------------------------------------------------------+
| GCM auth tag (16 bytes, appended)                        |
+----------------------------------------------------------+
```

The plaintext header is not authenticated by GCM. It carries no secret data and exists only to
identify the format and key fingerprint before attempting decryption. Restore re-validates the
header against the manifest's `archiveFormatVersion` and `encryption.keyFingerprint` after
decryption; a mismatch aborts restore.

The initial released format uses `archiveFormatVersion = 1`.

## Decrypted payload layout

After decryption, the payload is a gzip-compressed tar stream:

```text
manifest.json
checksums.sha256
database/
  remit.dump            (pg_dump --format=custom output)
uploads/
  <uploaded-file-1>
  <uploaded-file-2>
  ...
```

- `manifest.json` describes the archive and is the first entry in the tar so restore can stream the
  manifest before reading the rest.
- `checksums.sha256` lists `<sha256>  <path>` lines for `database/remit.dump` and every file under
  `uploads/`. Restore verifies every checksum before applying the archive.
- `database/remit.dump` is the output of `pg_dump --format=custom --no-owner --no-privileges`.
  Custom format gives a deterministic, restore-friendly binary that `pg_restore --clean --if-exists`
  can consume without role assumptions on the target instance.
- `uploads/` is a relative-path mirror under the `uploads/` prefix, preserving each stored object's
  relative key as `uploads/${upload.key}`. The storage adapter from ADR-0019 is responsible for
  streaming objects into the tar regardless of the runtime backend.
- The runtime image installs `postgresql16-client` so in-container `remit:backup` can invoke
  `pg_dump` against the PostgreSQL 16 service pinned in `docker-compose.yml`.

## Manifest shape

```json
{
  "archiveFormatVersion": 1,
  "appVersion": "1.2.3",
  "createdAt": "2026-05-17T10:00:00Z",
  "createdBy": "remit:backup",
  "schemaMigrationId": "0042_some_migration",
  "encryption": {
    "algorithm": "AES-256-GCM",
    "keySource": "REMIT_ENCRYPTION_KEY",
    "keyFingerprint": "sha256:<hex>"
  },
  "compression": "gzip",
  "components": {
    "database": {
      "format": "pg_dump-custom",
      "size": 1234567,
      "sha256": "<hex>"
    },
    "uploads": {
      "format": "tar-stream",
      "fileCount": 42,
      "totalSize": 9876543,
      "sha256Manifest": "<hex of checksums.sha256>"
    }
  },
  "destination": "local"
}
```

`destination` is one of `local`, `s3`, `r2`, or `b2`. It records where the archive was intended to
be stored. Restore accepts either a local file path or `remit://<destination>/<key>` for a remote
archive object.

## Encryption contract

- Algorithm: AES-256-GCM, algorithm byte `0x01`.
- Key: `REMIT_ENCRYPTION_KEY`, reused per ADR-0005. Backup does not introduce a second master
  secret.
- IV: 12 random bytes per archive, written into the plaintext header.
- Auth tag: 16 bytes, appended to the ciphertext.
- `keyFingerprint`: first 16 bytes of `SHA-256(rawKey)`, enough to detect mismatched keys during
  restore without disclosing the key.

Losing `REMIT_ENCRYPTION_KEY` loses both encrypted database columns and encrypted backup archives.
Encryption key rotation is defined by ADR-0021 and uses a two-key window to re-encrypt registered
database columns and existing backup archive envelopes.

## Destinations

Destinations match `settings.backup_destination` and ADR-0019:

| Destination | Status  | Storage contract                                                                          |
| ----------- | ------- | ----------------------------------------------------------------------------------------- |
| `local`     | Shipped | Writes to a local filesystem path under `REMIT_DATA_DIR`.                                 |
| `s3`        | Shipped | Writes encrypted `.remitbak` bytes to Amazon S3 using `settings.backup_s3_*` credentials. |
| `r2`        | Shipped | Writes encrypted `.remitbak` bytes to Cloudflare R2 through the S3-compatible adapter.    |
| `b2`        | Shipped | Writes encrypted `.remitbak` bytes to Backblaze B2 through the S3-compatible adapter.     |

A single `remit:backup` run writes to exactly one destination: the `--destination` flag when
provided, otherwise the destination configured in settings. Multi-destination fan-out is deferred.
An operator who wants redundant remote backups runs the command once per destination. Retention is
configurable as N daily, M weekly, and K monthly snapshots.

## Forward compatibility

Older versions of `remit:restore` must refuse archives with an `archiveFormatVersion` they do not
know how to read. Newer versions must accept every previously released format version.

Any change to the byte layout, encryption algorithm, manifest schema, or destination model that
breaks an existing version bumps `archiveFormatVersion` and is recorded in a new ADR that supersedes
ADR-0020 for that point.

## Audit behavior for backup

On completion or failure, `remit:backup` writes an `audit_log` entry with:

- `actorUserId: null`
- `actorRole: null`
- `targetEntityType: "instance"`
- Success metadata: `{ destination, archive, archiveAppVersion, schemaMigrationId }`
- Failure metadata: `{ destination, reason }`

The pre-restore snapshot call sets `skipStatusUpdate: true` and does not emit a backup audit entry.
Its audit trail is owned by `remit:restore`.
