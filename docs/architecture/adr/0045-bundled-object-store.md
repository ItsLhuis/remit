# ADR-0045: RustFS as the bundled object store, behind one vendor-neutral S3 adapter

- **Status:** Accepted
- **Date:** 2026-09-28
- **Supersedes:** [ADR-0019](0019-storage-backend-adapters.md) for runtime file storage only. Its
  backup-destination decision — `local` by default, S3, R2 and B2 from encrypted settings — stands.

## Context

Every file a freelancer cannot recreate lives in object storage: logos, avatars, client images,
template images, expense receipts, attachments, and the PDFs of issued invoices, proposals,
contracts and credit notes. Remit bundled MinIO for it. MinIO's community edition is no longer
maintained: its repository was archived, it stopped publishing images in October 2025, and the
images that were still pullable were withdrawn from Docker Hub on 2026-09-12 and from quay.io on
2026-09-25, which broke the install and end-to-end workflows on the pull. The stack survived on
Chainguard's maintained fork, `cgr.dev/chainguard/minio:latest`, run as root so existing root-owned
volumes would open.

The owner settled four things on 2026-09-26: runtime storage stays S3-compatible behind one adapter,
with no web console required; RustFS is the first choice unless evidence disqualifies it, with
Garage evaluated next; every `MINIO_*` variable is renamed to a vendor-neutral name; and the work is
finished only when it is complete and verified. Keeping files on the local filesystem by default —
the runtime half of ADR-0019, never implemented in the running application — is not what the owner
wants.

The disqualifiers were fixed before the evaluation: an unpatched Critical or High advisory in the
version to be pinned, or a fix that exists only unreleased; an authentication or signature bypass
class still recurring within the last 90 days; an open data-loss, corruption or unreadable-object
bug confirmed on a single node or across restarts or patch upgrades; an operation Remit uses that
the adapter cannot absorb safely; no public, immutable, multi-arch image or an incompatible licence;
no non-interactive single-node start with a usable health signal; any failed step of a hands-on
spike.

### What the evidence showed for RustFS 1.0.0 (read 2026-09-28)

- **Release and licence.** 1.0.0 is the latest stable release (2026-09-16, commit `d47f54bf`); 1.0.1
  exists only as daily previews. Apache-2.0. [Releases](https://github.com/rustfs/rustfs/releases).
- **Advisories.** 35 published between 2025-12-30 and 2026-09-08
  (`gh api repos/rustfs/rustfs/security-advisories`): 4 Critical, 14 High, 13 Medium, 4 Low. Every
  one names a fixed version at or before 1.0.0, and none is known to affect 1.0.0.
- **Recurrence.** The last unauthenticated bypass was published 2026-05-09 (profiling endpoints,
  GHSA-8784-9m7f-c6p6, fixed in beta.9) — outside the 90-day window. The console's stored XSS
  (GHSA-v9fg-3cr2-277j, then its incomplete fix GHSA-7gcx-wg4x-q9x6 on 2026-06-26) is in a component
  Remit disables. Inside the window sit two classes: authorization of non-root principals (service
  accounts and IAM policy conditions: GHSA-5354-r3w2-34m8 on 2026-07-23, GHSA-6r96-hmgc-726c,
  GHSA-v9cp-qfw9-9pfp and GHSA-5w8r-p896-6vq2 on 2026-08-09), and the header scope of presigned
  uploads (GHSA-g8w9-qw9q-fghr on 2026-09-08, after GHSA-w5fh-f8xh-5x3p on POST policies in
  February). Neither is an authentication or signature bypass on a SigV4 request signed with a
  credential: the first needs a scoped principal, the second a presigned URL minted by a credential
  holder. Remit creates neither.
- **Open bugs.** No confirmed data-loss or corruption bug on a single node.
  [#8121](https://github.com/rustfs/rustfs/issues/8121) (memory that ratchets until an OOM kill
  after days, on an NFS-backed single disk) is availability, still being confirmed.
  [#8003](https://github.com/rustfs/rustfs/issues/8003) (a multi-node upgrade between pre-releases)
  is unconfirmed and reports data intact. [#7958](https://github.com/rustfs/rustfs/issues/7958) — a
  paginated `ListObjectsV2` could report a false end of listing under heavy filtering — is confirmed
  and fixed only on the main branch (2026-09-18), so 1.0.0 carries it.
- **Spike on this project's host, the pinned digest, the repository's own `@aws-sdk/client-s3`.**
  Every operation Remit uses behaved correctly with the SDK's default checksums and with
  `WHEN_REQUIRED`: a missing key answers 404 `NoSuchKey`, a missing bucket 404; `CreateBucket` is
  idempotent; deleting a deleted key succeeds; a body shorter than its `Content-Length` stores
  nothing. 3,000 objects in Remit's key layout — one directory per document — listed completely at
  page sizes from 7 to 1,000, before and after deleting three quarters of them, and read back
  byte-identical. A 200 MB streamed object round-tripped. A restart kept everything. Four
  `docker kill`s in the middle of a 3 GB streamed write left the key absent every time, never
  truncated, with no temporary leftovers. #7958 did not reproduce.
- **Image and runtime.** `rustfs/rustfs:1.0.0` and `ghcr.io/rustfs/rustfs:1.0.0` are the same
  multi-arch index (`linux/amd64`, `linux/arm64`), digest `sha256:8cc98017…58f4d1ff`. The image runs
  as uid 10001, takes credentials from `RUSTFS_ACCESS_KEY` and `RUSTFS_SECRET_KEY`, starts
  non-interactively on an empty volume, and answers `/health/ready` to the `curl` it ships. It
  serves a web console on 9001 by default (`RUSTFS_CONSOLE_ENABLE=false` removes the listener),
  calls `version.rustfs.com` at startup by default (`RUSTFS_CHECK_UPDATE=false` stops it, which
  ADR-0018 requires), and logs to a file inside the container unless `RUSTFS_OBS_LOG_DIRECTORY` is
  empty. RustFS 1.0.0 meets no disqualifier, so Garage was not taken through the gate.

## Decision

**The bundled store is RustFS 1.0.0**, pinned in every Compose file as
`ghcr.io/rustfs/rustfs:1.0.0@sha256:8cc9801755448b71a786705ce76692c77e14936cccd87cf2fc31842e58f4d1ff`.
It runs with the console disabled, the update check off, logs on stdout, no published port in
production, the image's own non-root user on a new `storage_data` volume, and a health check that
curls `/health/ready`.

**Supply chain.** An exact version tag and the index digest, never `latest`: the digest makes the
reference immutable and verifiable, the tag says which release it is. GHCR rather than Docker Hub,
because it is where Remit's own images live and has no anonymous pull quota. The image workflow
copies the pinned store image into this project's own GHCR namespace on every run, digest for
digest, so the bytes stay available under the project's control if upstream withdraws a tag again;
switching a reference to the copy changes the registry and nothing else. Compose keeps the upstream
reference because the project namespace is not yet published, and a pull-request run could not pull
from it.

**One adapter, vendor-neutral configuration.** `lib/storage/s3.ts` stays the only runtime S3 client.
It is configured by `S3_ENDPOINT`, `S3_REGION` (default `us-east-1`), `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, `S3_BUCKET` (default `remit`) and `S3_FORCE_PATH_STYLE` (default true), and
is handed its credentials explicitly. `AWS_*` names are never used: the SDK's default credential
chain reads them implicitly, and a stray one in an operator's environment would silently become
Remit's identity. `S3_ENDPOINT` stays required even though the SDK could derive an AWS endpoint from
the region, so an unset endpoint fails at boot instead of sending the store's credentials to AWS.

**Checksums: `WHEN_REQUIRED`**, for the runtime client and the backup destinations alike. It is the
one setting RustFS, Amazon S3, Cloudflare R2 and Backblaze B2 all accept: the SDK's default sends
CRC32 checksums in `aws-chunked` trailers, which R2 has handled inconsistently and B2 only since
July 2025. Integrity does not depend on the transport checksum: every upload is read back and hashed
before a row may name it (`lib/storage/verifyUploadedObject.ts`), and backup and restore verify
every object by SHA-256.

**The application keeps the store's root credential.** Least privilege was weighed and not taken for
the bundled store. RustFS creates scoped keys only through its admin API, which nothing in the image
can call, so install and upgrade would need a signed admin request from a one-off container on every
new instance; and the class of advisory still recurring in RustFS is precisely the authorization of
scoped principals, so a scoped key would buy little isolation for that cost. The store is reachable
only inside the Compose network, and the application and worker are its only clients. An operator
who points `S3_*` at AWS S3, R2 or B2 supplies a key scoped to the three buckets instead, and may
create them in advance.

**Bucket bootstrap tolerates a key that cannot manage buckets.** The three buckets are
`<S3_BUCKET>`, `<S3_BUCKET>-documents` and `<S3_BUCKET>-exports`. Bootstrap creates one only when
`HeadBucket` answers 404; a 403 means the bucket exists and the key may not inspect it, which is not
Remit's to fix, and the object calls that follow succeed or fail on their own permissions.

## Consequences

### Positive

- The bundled store is pinned to bytes that cannot change under a running instance, and a copy of
  them lives in the project's own registry.
- The same six variables drive the bundled store and any external S3 service, and no variable, file,
  service or volume name ties Remit to one vendor.
- No console and no outbound call exist to be reached or audited.

### Negative

- RustFS is young: 35 advisories in nine months, all fixed, and its 1.0.x line moves daily. Moving
  the pin is a deliberate change that has to repeat the spike, not a tag bump.
- 1.0.0 carries a listing bug fixed only on main. Backups cross-check every `uploads` row against
  the listing and fail loudly rather than omit a file (ADR-0046).
- The application holds the root credential of its bundled store, as it did with MinIO.

## Alternatives considered

### Local filesystem as the default runtime store

ADR-0019's runtime half. It would remove a service, but the owner decided on 2026-09-26 that runtime
storage stays S3-compatible behind one adapter, and the application has never had a filesystem
adapter to fall back on.

### Stay on Chainguard's MinIO fork

It was rejected because it is one vendor's best-effort build of an archived project, whose free tier
publishes only `latest` and rebuilds it daily — the third image source for this service in two weeks
— and because keeping it would keep every name this change exists to remove.

### Garage

AGPL-3.0, Rust, v2.3.0, in production at Deuxfleurs since 2020, no console. Its single-node start
needs a `layout assign` and `layout apply` and keys created or imported through its CLI or admin
API, which install and upgrade would have to script. It was the owner's fallback and would have been
taken through the same gate had RustFS failed it.

### SeaweedFS or Versity S3 Gateway

Next in line after Garage; not evaluated, since the gate selected RustFS.

### A scoped key for the bundled store

See the decision above: the admin-API bootstrap it needs in install and upgrade, against isolation
that rests on the class of RustFS advisory still recurring.
