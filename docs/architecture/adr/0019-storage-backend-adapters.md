# ADR-0019: Storage backend as swappable adapter — local FS by default, S3/R2/B2 opt-in

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Remit stores runtime files such as uploads and generated documents today. The architecture also
accounts for backup bundles once backup jobs are implemented.
[Architecture: Self-hosting experience, Backup and restore](../ARCHITECTURE.md#backup-and-restore)
defines the planned backup and restore flow around local filesystem storage by default, with Amazon
S3, Cloudflare R2, and Backblaze B2 as configurable backup destinations.

The existing `lib/storage/` module centralizes runtime storage URL and S3-compatible behavior.
Runtime object storage connection details are deployment-owned environment configuration, while the
backup destination, retention policy, and backup S3-compatible credentials are instance settings so
an owner can manage and test backup policy from the UI. The direction follows the same adapter
principle as email: local operation first, external providers only when the operator opts in.

Self-hosters have different constraints. Some want all data on a local disk they back up themselves;
others need object storage for remote backups, hosted-like durability, or large file volumes.

## Decision

Runtime file storage uses a swappable backend adapter. Planned backup bundle storage follows the
same adapter model. Local filesystem storage is the default. S3-compatible providers such as Amazon
S3, Cloudflare R2, and Backblaze B2 are available through opt-in configuration, with runtime storage
owned by deployment environment variables and backup storage owned by encrypted settings.

## Consequences

### Positive

- A default install works without cloud credentials or mandatory third-party storage.
- Operators can choose remote object storage when their backup or durability requirements need it.

### Negative

- Storage code must preserve one contract across backends with different consistency, credential,
  and URL semantics.
- Local filesystem defaults make disk capacity and volume backup an operator responsibility.

## Alternatives considered

### S3-compatible storage only

Requiring object storage would simplify remote backup behavior. It was rejected because it would
make a cloud-style dependency mandatory for small self-hosted installs.

### Database blob storage

Storing files in PostgreSQL would simplify backup consistency. It was rejected because large uploads
and generated documents would bloat the database and complicate restore and serving performance.
