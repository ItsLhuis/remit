# ADR-0046: Backups carry the stored files

- **Status:** Accepted
- **Date:** 2026-09-28
- **Supersedes:** [ADR-0020](0020-operational-cli-contract.md) for the archive's decrypted payload
  layout. Every other point of ADR-0020 stands.

## Context

A `.remitbak` archive carried the database and the files under `$REMIT_DATA_DIR/uploads`, a local
mirror the backup specification expected a storage adapter to fill and that nothing in the running
application ever wrote. Every stored file — logos, avatars, receipts, attachments, the PDFs of
issued documents, data exports — lives in object storage, so a real instance's archive held none of
them, and a restore, which the upgrade script names as its rollback, could not bring any back. On an
instance holding 24 stored files and 3 exports, a fresh archive verified by
`remit:restore --dry-run` reported `Uploads: 0 files`.

## Decision

### The archive carries the stored files by bucket role

Archive format version 2. The decrypted tar holds `manifest.json`, `checksums.sha256`,
`database/remit.dump`, then one entry per object under `objects/public/<key>` and
`objects/documents/<key>`. The path records the bucket's **role**, never its physical name, so an
archive restores into an instance whose `S3_BUCKET` differs. The manifest's `components.objects`
carries the checksum file's hash and a file count and total size per role.

The exports bucket is not archived. Its objects are whole-instance exports and report PDFs, each
regenerable on demand from the database the archive already holds, and archiving the whole instance
inside every backup of the whole instance would multiply the archive for nothing an operator could
not produce again. Keys under `remit-backups/` are left out too, and a restore never deletes them:
they are archives a remote backup destination pointed at a storage bucket wrote there, and carrying
them would nest every earlier archive in the next while deleting them would erase the history. An
object under a key the archive cannot hold — an empty or `..` segment, a backslash, a control
character, a path too long for a tar entry — gets the same treatment: Remit writes no such key, so
it is something else's object, and one "folder" marker made in a provider's console must not stop
every backup and, through the pre-restore snapshot, every restore. It is left out and counted, and a
restore never deletes it.

A backup dumps the database first, reads the `uploads` rows second and lists the objects last, so
any file the dump or the rows reference was already stored when the listing ran; the window left is
a file deleted during the backup, which the restored database still names and which the owner had
deleted anyway, and the backup leaves it out rather than fail. Rows read after the listing would
count a file uploaded during it as one the listing missed. Every `uploads` row is checked against
the listing, and a row whose object exists but was not listed fails the backup: a listing that
silently ends early — RustFS 1.0.0 carries such a bug, ADR-0045 — can never produce an archive that
looks complete. The objects are read twice, once to hash them for `checksums.sha256`, which precedes
them in the tar, and once to stream them in, and the second read is hashed again and must match:
Remit's keys are written once, so a mismatch is corruption, and it discards the archive. Only a 404
means a file is gone: the listing has proved the key may list the bucket, so a 403 on a read is a
refusal, and it fails the backup instead of yielding an archive that silently lacks the file. A
missing public bucket fails it for the same reason, since the application creates that bucket at
boot.

An archive larger than 256 MiB goes to a remote destination as a multipart upload, so the 5 GiB
single-request ceiling no longer bounds an instance's backups.

### A restore writes and verifies everything before it deletes anything

S3 has no atomic swap, so a restore orders its steps so that every point it can stop at leaves an
instance a re-run repairs:

1. Every archived object is put into its bucket and read back, and its SHA-256 compared with the
   archive's. Nothing the live instance references is removed.
2. The database is replaced in one transaction.
3. Forward migrations run and the pre-restore audit entries are replayed.
4. Objects the archive does not contain are deleted from the public and documents buckets.

A failure in step 1 leaves the old database with every file it names; one in step 2 rolls the
database back over a store that is a superset of both; one in step 3 or 4 leaves the new database
with every file it names and some it does not. The deletions are last, after the migrations, because
they are one request per object and the likeliest step to fail, and a failure there must not leave
an unmigrated database behind. The mandatory pre-restore snapshot now carries the files too, and
remains the way back.

Step 4 deletes whatever the archive lacks, whoever wrote it, so the two buckets must be Remit's
alone. Archived files are staged for step 1 under names taken from their position in the archive,
not from their keys: keys that are distinct in a bucket can collide as file paths.

The local uploads mirror, its swap and `REMIT_UPLOADS_DIR` are removed; nothing reads or writes them
any more.

## Consequences

### Positive

- Every backup, scheduled or manual, and every pre-restore snapshot carries every file an owner
  cannot recreate, and restores it byte for byte.
- An archive restores into an instance with a different bucket name.

### Negative

- A backup reads every stored object twice, and a restore needs free space for the archive, the
  staged files and the pre-restore snapshot at once.
- Between steps 1 and 4 of a restore the store holds files of both instances; a scheduled backup
  running then would archive that state. The restore does not lock scheduled backups out.

## Alternatives considered

### Record each object's checksum after it in the tar

One read per object instead of two, at the cost of restore verifying at the end rather than as it
goes, and of reordering a format whose manifest-then-checksums prefix the restore parser relies on.
Remit's stores are local and its instances small, so the second read is the cheaper price.

### Restore the database first, then the files

A failure among the files would then leave the restored database pointing at objects the store never
received.
