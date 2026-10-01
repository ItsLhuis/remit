# Vendor-neutral object storage and file-carrying backups

- **Status:** Shipped
- **Date:** 2026-09-30
- **Verdict:** Complete
- **Decisions:** ADR-0045, ADR-0046 (superseding parts of ADR-0019 and ADR-0020), ADR-0040
- **Supersedes:** —

## What

Every stored file lives in a bundled object store Remit pins and can trust, reached through one
vendor-neutral S3 adapter that an operator can also point at Amazon S3, Cloudflare R2 or Backblaze
B2, and every backup carries those files and every restore puts them back.

## Why

MinIO's community edition stopped being maintained: its repository was archived, it stopped
publishing images, and the images that could still be pulled were withdrawn from Docker Hub and then
from quay.io, which broke the install and end-to-end workflows on the pull. Every object-storage
variable, the Compose service and volume, the installer and the documentation were named after it.

Backups did not carry stored files. `remit:backup` archived the database and the contents of a local
uploads directory that nothing in the running application writes to, so a Docker deployment's
archive held none of the logos, avatars, receipts, attachments or issued PDFs, and `remit:restore`
could not bring any of them back.

## Scope

Included:

- The choice of the bundled store, on researched and observed evidence, recorded in ADR-0045.
- One S3 adapter configured by vendor-neutral `S3_*` variables.
- The pinned store in the production, development, test and CI stacks, the installer, and the image
  mirror.
- Backups that archive the public and documents buckets by role, and restores that write them back
  with replace semantics.
- Every current document.

Excluded:

- The exports bucket's contents in backups: its objects are regenerable whole-instance exports, the
  reasoning is in ADR-0046.
- A scoped storage key for the application: the reasoning is in ADR-0045.

## How

- **One adapter.** `lib/storage/objectStore.ts` addresses every S3 call by bucket role (public,
  documents, exports) over an injected client; `lib/storage/clientConfig.ts` builds every client
  Remit makes for object storage with explicit credentials, path-style addressing and
  `WHEN_REQUIRED` checksums; `lib/storage/s3.ts` is the runtime instance over `S3_*` and keeps every
  caller-facing export. Bucket bootstrap creates only on 404 and treats 403 as present; a missing
  key is 404 or 403.
- **Configuration.** `lib/config/envSchema.ts` defines the six `S3_*` variables.
- **Stacks.** Every Compose file runs RustFS 1.0.0 by tag and digest as `storage` on `storage_data`,
  console and update check off, no published port in production; the test stack runs it on 9020. The
  image workflow mirrors the digest into the project's registry, and
  `tests/docs/pinnedImages.test.ts` holds every reference to it. The installer writes the new
  variables.
- **Backups.** Archive format 2 (ADR-0046): the database dump, then every object of the public and
  documents buckets under `objects/<role>/<key>`, listed after the dump and after the `uploads` rows
  are read, cross-checked against those rows, read once to hash and once to stream with the second
  hash compared. A file deleted while the backup reads it is left out and counted, and so is an
  object under a key Remit never writes; a refused read or a missing public bucket fails the backup;
  archives a remote destination wrote under `remit-backups/` into a storage bucket are never
  archived. Remote archives above 256 MiB upload in parts (`lib/backups/multipart.ts`). Key rotation
  re-encrypts archives by streaming through a temporary file (`scripts/core/archive/reencrypt.ts`).
- **Restores.** Files are written and read back first, the database replaced and migrated second,
  files the archive lacks deleted last, never a `remit-backups/` archive or an object no backup
  could have carried. The local uploads mirror, its swap and `REMIT_UPLOADS_DIR` are gone.

## Evidence

- ADR-0045 (the store, supply chain, checksums, credentials, bucket bootstrap), ADR-0046 (archive
  format 2, restore order)
- `lib/storage/objectStore.ts`, `clientConfig.ts`, `bucketNames.ts`, `objectErrors.ts`, `s3.ts`;
  `lib/config/envSchema.ts`, `env.ts`
- `scripts/core/backup/objectPlan.ts`, `objects.ts`, `writeArchive.ts`, `manifest.ts`,
  `executeBackup.ts`; `lib/backups/destination.ts`, `multipart.ts`;
  `scripts/core/archive/reencrypt.ts`; `scripts/core/keyRotation/archives.ts`
- `scripts/core/restore/manifestSchema.ts`, `verifyArchive.ts`, `applyObjects.ts`,
  `objectDeletions.ts`, `runRestore.ts`
- `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.test.yml`,
  `docker-compose.ci.yml`, `Dockerfile`
- `scripts/host/install.sh`, `upgrade.sh`, `_check-prereqs.sh` and their tests
- `.github/workflows/ci.yml`, `docker.yml`, `e2e.yml`, `install.yml`
- `tests/integration/storageTargets.ts`, `tests/docs/pinnedImages.test.ts`
- `docs/architecture/specs/BACKUP-ARCHIVE.md`, `docs/architecture/operations/CLI-CONTRACT.md`,
  `docs/operations/INSTALL.md`, `UPGRADE.md`, `RESTORE.md`, `docs/architecture/ARCHITECTURE.md`,
  `docs/deploy/*`, `CHANGELOG.md`

## Verification

Observed between 2026-09-28 and 2026-09-30 on the development host, a Windows machine running Docker
Desktop, every check run rather than reasoned about:

- **Gates.** Typecheck, lint with no new warning, formatting, the unit suite with the services
  coverage gate, the documentation tests including the pinned-image guard, the operational script
  bundle, the application and worker images, `docker compose config` for every Compose file and
  combination the workflows use, and the fallow and react-doctor audits of the change.
- **The adapter.** The storage contract suite passed against the pinned RustFS, and the whole
  integration suite passed on a freshly created test stack, as CI runs it. A key allowed only to
  read, write and delete objects in three buckets another identity had created was refused bucket
  creation while bootstrap and every object operation worked, and a missing key classified as
  missing.
- **The stacks.** The end-to-end suite passed in full on a fresh stack built from the working tree,
  registration and both backup flows included. The install workflow was reproduced in a directory
  that is not a checkout: unattended install, health, the redirect to registration, a worker that
  stays up, a second run that keeps the encryption key, and a backup that carried the files once
  files had been stored through the application. The application ran against three buckets created
  in advance under that restricted key, stored files of every kind in them and backed them up.
- **Backups and restores.** A backup restored into an empty instance whose bucket name differed, and
  every archived file came back byte for byte. The bundled store, killed during a large write and
  restarted, held no trace of the object and everything else intact.
- **Reviews.** A code review and a security review of the whole change ran before sealing; every
  finding was fixed or answered, and the gates above ran again on the result.

Not covered: no Amazon S3, Cloudflare R2 or Backblaze B2 account was available, so the adapter and
remote backups were exercised against S3-compatible stand-ins only; the changed workflows were
reproduced locally rather than run on GitHub; and the `.env` mode check runs only in the Linux tests
and CI, since this host's filesystem cannot represent the mode.

## Known gaps

None.
