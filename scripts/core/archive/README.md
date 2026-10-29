# Backup archive

A backup is one encrypted `.remitbak` file. The byte layout is documented where it is written, in
`scripts/core/archive/header.ts`; the manifest inside the archive is the schema in
`scripts/core/restore/manifestSchema.ts`. This file keeps what neither says: the compatibility
promise and where each destination puts an archive.

## Forward compatibility

- `ARCHIVE_FORMAT_VERSION` in `scripts/core/archive/header.ts` is the version a backup writes.
  Restore reads exactly the versions in `SUPPORTED_ARCHIVE_VERSIONS`
  (`scripts/core/restore/manifestSchema.ts`). A change to the byte layout, the encryption algorithm
  or the manifest schema that an existing version cannot express adds a version, and a build that
  adds one keeps reading the versions it listed before.
- A build that meets a version it does not read refuses the restore in
  `scripts/core/restore/header.ts`. A version above the highest it knows is reported as newer than
  the build supports and asks for an upgrade; any other unknown version is reported as unsupported.
  Nothing is applied to the instance.
- The header version and the manifest's `archiveFormatVersion` must agree, or restore refuses
  (`scripts/core/restore/verifyArchive.ts`).
- Restore also refuses an archive whose manifest `appVersion` is newer than the running build
  (`assertArchiveAppVersionAllowed` in `scripts/core/restore/manifestSchema.ts`).

## Destinations

`settings.backup_destination` (`database/schema/settings.ts`) holds the default; a
`remit:backup --destination` flag overrides it for one run (`scripts/core/backup/args.ts`). One run
writes to one destination; an operator who wants redundant copies runs the command once per
destination.

| Destination | Where the archive goes                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| `local`     | `<REMIT_DATA_DIR>/backups/<filename>`, or the path given to `--output`                                  |
| `s3`        | Key `remit-backups/<YYYY>/<MM>/<filename>` in the bucket of the `settings.backup_s3_*` fields           |
| `r2`        | The same key through the S3-compatible adapter; the endpoint derives from the account unless one is set |
| `b2`        | The same key through the S3-compatible adapter; the endpoint derives from the region unless one is set  |

The filename is `remit-backup-<YYYYMMDDTHHMMSSZ>-v<appVersion>.remitbak`
(`scripts/core/backup/plan.ts`, `scripts/core/backup/filename.ts`). Credentials and endpoints
resolve in `lib/backups/destinationConfig.ts`. `--output` cannot be combined with a remote
destination. Restore takes a local path or `remit://<s3|r2|b2>/<key>`
(`scripts/core/restore/remoteDownload.ts`).

An archive above 256 MiB goes to a remote destination in parts of 64 MiB, larger when the archive
would otherwise need more than 10,000 parts (`lib/backups/multipart.ts`). One part is held in memory
at a time, and a failed part aborts the upload. A process killed outright cannot abort, so the parts
it had sent stay at the destination, billed and absent from a listing: give the destination bucket a
lifecycle rule that expires incomplete multipart uploads.
