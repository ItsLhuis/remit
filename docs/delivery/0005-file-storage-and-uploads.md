# DR-0005: File storage adapters and uploads

- **Status:** Shipped
- **Date:** 2026-05-19
- **Verdict:** Complete
- **Decisions:** ADR-0019
- **Supersedes:** —
- **Reconstructed:** yes

## What

A storage layer with local-filesystem and S3-compatible backends behind one interface, a presigned
upload route, and the content-addressed `uploads` table every file reference points at.

## Why

Remit stores avatars, business logos, receipts and rendered PDFs. A self-hoster on a single box
wants those on a disk they can back up; an operator running several instances wants them in an
object store. Binding the product to either one would have made the other a rewrite. Uploading
through the application server would also have put every file byte through Node for no benefit.

## Scope

Included: the adapter interface with local and S3-compatible implementations, presigned upload URLs
issued by a session-checked route, per-type size and MIME limits, verification that the object the
client claims to have uploaded actually exists and matches what was declared, the `uploads` table,
and a storage health check.

Excluded: the object store owning authorization. `uploads` deliberately carries **no owner column**;
authorization comes from the record that references the blob. Also excluded is soft delete for
uploads — removing an upload row is a hard delete, which is why every reference to it is
`on delete set null`.

## How

The upload is a two-step handshake, not a proxy: the route validates the session and the declared
type, issues a presigned URL scoped to one object key, and the browser uploads directly. The server
then verifies the stored object before writing the `uploads` row, because between those two steps
the client is the only thing that has spoken and nothing it said can be trusted.

One `app/api/upload/[type]/route.ts` handles every upload type through a per-type config rather than
one route per type. The type is a route parameter resolved against a known table, so an unknown type
is a 404 rather than an unconstrained upload.

The public storage origin is added to the Content-Security-Policy dynamically, in `proxy.ts`,
because it is configuration rather than a constant and a static CSP would either be wrong or too
permissive.

## Evidence

- `lib/storage/index.ts`, `lib/storage/local.ts`, `lib/storage/s3.ts`, `lib/storage/limits.ts`,
  `lib/storage/verifyUploadedObject.ts`
- `app/api/upload/[type]/route.ts`
- `database/schema/uploads.ts` — the file-top comment recording the no-owner and hard-delete
  invariants
- `proxy.ts` — the storage origin in the Content-Security-Policy
- `docs/architecture/adr/0019-storage-backend-adapters.md`

## Verification

`lib/storage/__tests__/verifyUploadedObject.test.ts` covers the post-upload verification, and
`app/api/upload/__tests__/upload-routes.test.ts` covers the presign route's session check, type
resolution and limit enforcement. Local development runs against MinIO in the development Compose
stack, which is the same S3 code path used in production.

Not covered by an automated test: a real S3, R2 or Backblaze B2 endpoint. The S3-compatible adapter
is verified against MinIO only.

## Known gaps

No orphan sweep exists: an `uploads` row whose referencing record was set to null keeps its object
in the store. ADR-0028 records that a sweeper job was considered and rejected.
