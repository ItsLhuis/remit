# Backup Archive Format

This document is the implementation-facing specification for Remit's encrypted `.remitbak` archive
format. The architecture overview summarizes the backup model; this file defines the durable archive
contract used by `remit:backup` and `remit:restore`.

ADR-0020 owns the accepted architectural decision; ADR-0046 supersedes it for the decrypted payload
layout, which since format version 2 carries the stored files. Changes that break a released archive
format must bump `archiveFormatVersion` and be recorded in a later ADR.

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

`remit:backup` writes and `remit:restore` reads `archiveFormatVersion = 2`: the database and every
object of the public and documents buckets (ADR-0046).

## Decrypted payload layout

After decryption, the payload is a gzip-compressed tar stream:

```text
manifest.json
checksums.sha256
database/
  remit.dump            (pg_dump --format=custom output)
objects/
  public/
    <key>               (one entry per object in the public bucket)
  documents/
    <key>               (one entry per object in the documents bucket)
```

- `manifest.json` describes the archive and is the first entry in the tar so restore can stream the
  manifest before reading the rest.
- `checksums.sha256` lists `<sha256>  <path>` lines for `database/remit.dump` and every file under
  `objects/`, and precedes them, so restore verifies each entry as it streams past and every
  checksum before it applies anything.
- `database/remit.dump` is the output of `pg_dump --format=custom --no-owner --no-privileges`.
  Custom format gives a deterministic, restore-friendly binary that `pg_restore --clean --if-exists`
  can consume without role assumptions on the target instance.
- `objects/<role>/<key>` holds each stored object under its object key. The path records the
  bucket's **role** (`public` or `documents`), never its physical name, so an archive restores into
  an instance whose `S3_BUCKET` differs from the one that wrote it.
- The exports bucket (data exports and report PDFs) is not archived: each of its objects is
  regenerable on demand from the database the archive already holds.
- Keys under `remit-backups/` are not archived either, and a restore never deletes them: they are
  the archives a remote backup destination wrote into one of the storage buckets, not stored files.
- A key the archive cannot hold is left out and counted, and a restore never deletes it: an empty
  key, a leading `/`, an empty, `.` or `..` segment (a console's "folder" marker ends in `/`), a
  backslash, a control character (a line break would split the key's `checksums.sha256` line), or a
  path longer than a ustar entry allows. Remit writes no such key, so such an object was put in the
  bucket by something else. The count is reported as a warning by the command and in the worker's
  log. A file the database names under such a key fails the backup instead.
- The runtime image installs `postgresql16-client` so in-container `remit:backup` can invoke
  `pg_dump` against the PostgreSQL 16 service pinned in `docker-compose.yml`.

## How a backup reads the object store

1. The database is dumped first, the `uploads` rows are read next, and the buckets are listed last.
   An object is stored before the row that names it, so every file the dump or the rows reference
   was already stored when the listing ran, and a file uploaded during the listing is not mistaken
   for one the listing missed. A public bucket that does not exist fails the backup: the application
   creates it at boot, so its absence means the command is pointed at another store. The documents
   bucket is created by its first writer and may legitimately be missing.
2. Every `uploads` row is checked against the listing. A row whose object exists but was not listed
   fails the backup, so a listing that ends early can never produce an archive that looks complete.
   A row whose object is truly gone (an earlier interrupted delete) is counted and reported, not
   fatal.
3. Every object is read once to hash it for `checksums.sha256`, and again as it streams into the
   tar, hashed a second time. Remit writes every key once, so a mismatch is corruption and discards
   the archive. An object deleted between the listing and the first read is left out and counted
   like a missing one; one deleted between the two reads discards the archive, which already
   promised it, and the next backup succeeds.
4. Only a 404 counts as "gone", in the cross-check and in both reads. The listing has already proved
   the key may list the bucket, under which a missing key answers 404; a 403 is a refused read, and
   it fails the backup rather than producing an archive without the file.

## Manifest shape

```json
{
  "archiveFormatVersion": 2,
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
    "objects": {
      "format": "tar-stream",
      "sha256Manifest": "<hex of checksums.sha256>",
      "buckets": {
        "public": { "fileCount": 40, "totalSize": 1876543 },
        "documents": { "fileCount": 12, "totalSize": 8000000 }
      },
      "contentTypes": {
        "objects/public/logos/<uuid>.png": "image/png",
        "objects/documents/documents/invoice/<id>/<random>.pdf": "application/pdf"
      }
    }
  },
  "destination": "local"
}
```

`contentTypes` records the type each object was stored with, so a restore puts it back with the same
type; the storage route serves files under `nosniff`, and an image returned as
`application/octet-stream` would never render.

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
database columns and existing backup archive envelopes. Re-encryption streams: it rewrites the
header and the manifest's `keyFingerprint` and passes every other entry through unchanged, through a
temporary file, so an archive's size never has to fit in memory.

## Destinations

Destinations match `settings.backup_destination` and ADR-0019:

| Destination | Status  | Storage contract                                                                          |
| ----------- | ------- | ----------------------------------------------------------------------------------------- |
| `local`     | Shipped | Writes to a local filesystem path under `REMIT_DATA_DIR`.                                 |
| `s3`        | Shipped | Writes encrypted `.remitbak` bytes to Amazon S3 using `settings.backup_s3_*` credentials. |
| `r2`        | Shipped | Writes encrypted `.remitbak` bytes to Cloudflare R2 through the S3-compatible adapter.    |
| `b2`        | Shipped | Writes encrypted `.remitbak` bytes to Backblaze B2 through the S3-compatible adapter.     |

An archive larger than 256 MiB is uploaded to a remote destination in 64 MiB parts (larger when the
archive would otherwise need more than 10,000), so S3's 5 GiB single-request limit does not bound an
instance's backups. One part is held in memory at a time. A failed part aborts the upload, and the
destination keeps nothing of it. A process killed outright cannot abort, and the parts it had sent
stay at the destination, billed and invisible in a listing, so give the destination bucket a
lifecycle rule that expires incomplete multipart uploads.

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
