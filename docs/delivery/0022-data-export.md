# DR-0022: Account data export

- **Status:** Shipped
- **Date:** 2026-08-13
- **Verdict:** Complete
- **Decisions:** ADR-0010, ADR-0019
- **Supersedes:** —
- **Reconstructed:** yes

## What

A GDPR-aligned export of every entity, uploaded file and rendered PDF in the instance, assembled as
a streamed archive with a manifest and downloaded through an authorized route.

## Why

Data ownership is Remit's first principle, and a product that will not hand back the data is
self-hosted in name only. The export is also the practical answer to a subject access request and to
the moment a freelancer wants to leave — both of which are commitments the README makes.

## Scope

Included: export of the instance tables and the per-client subgraph, the uploaded objects and
rendered document PDFs, a manifest describing what the archive contains, progress and status
tracking, and a download route that authorizes before streaming.

Excluded: an import path. Restoring an instance from an archive is what the backup and restore
commands do, with a format designed for it. Also excluded: exporting Better Auth-owned credential
material — password hashes, TOTP secrets and backup codes are not data the subject needs and are not
data anyone should be handed a copy of.

## How

The archive is written as a stream rather than assembled in memory, because an instance with years
of receipts and rendered PDFs does not fit in a container's heap.

Assembly runs as a background job rather than inside the request, so a large export does not hold a
request handler open and can survive the browser closing. Status and progress are persisted, so the
page reports where it is rather than guessing.

The manifest is generated from the same table inventory the export walks, so it cannot describe a
table the archive does not carry.

The download route authorizes the session against the export record before streaming a byte, because
the archive is the single most sensitive artefact the product produces.

## Evidence

- `features/dataExport/services/` — `exportInstanceTables.ts`, `exportSubgraphTables.ts`,
  `exportManifest.ts`, `exportIndex.ts`, `exportProgress.ts`, `exportStatus.ts`, `exportFilename.ts`
- `features/dataExport/jobs.ts`, `features/dataExport/mutations.ts`
- `lib/archive/` — the streaming zip writer and S3 archive helpers
- `app/api/exports/[id]/route.ts`, `app/(dashboard)/settings/data/`
- `database/schema/dataExports.ts`
- `docs/architecture/ARCHITECTURE.md` — Security architecture, Data export and deletion

## Verification

`features/dataExport/__tests__/export.integration.test.ts` covers a full assembly against a real
Postgres, and `manifest.integration.test.ts` asserts the manifest matches the archive contents.
`mutations.integration.test.ts` covers request and status transitions. Service tests cover the table
inventories, filename construction, progress and status derivation.

Not covered by an automated test: the download route streaming a multi-gigabyte archive. Size
behaviour is verified by construction rather than at scale.

## Known gaps

`README.md` pairs the export with "the right to be forgotten with a configurable fiscal retention
window". The export half exists; there is no trash, no restore and no retention column anywhere in
the schema, so the deletion half of that sentence has no implementation. ADR-0010's positive
consequence that users can restore accidentally deleted records is not true today: soft delete
shipped and restore did not.
