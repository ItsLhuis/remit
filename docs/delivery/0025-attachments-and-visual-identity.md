# DR-0025: Attachments and visual identity

- **Status:** Shipped
- **Date:** 2026-08-25
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0019, ADR-0028
- **Supersedes:** —
- **Reconstructed:** yes

## What

An `attachments` table letting clients, projects, invoices and expenses carry any number of files, a
shared upload primitive replacing four hand-rolled ones, and a client image so the record a
freelancer looks at most has a visual identity.

## Why

Remit stored files well and showed them badly. Every reference to `uploads` was a single nullable
foreign key — one avatar, one logo, one receipt — so nothing could carry a second file. A freelancer
with a signed NDA, a brief and three reference images for one project had nowhere to put any of
them. The upload interaction had also been rebuilt from scratch four times, with four hidden inputs,
four presign calls and four error surfaces.

## Scope

Included: the `attachments` table with one nullable foreign key per attachable parent and a check
asserting exactly one is set; attachment panels on client, project, invoice and expense pages; an
authorized download route; shared file-upload primitives and a `useFileUpload` hook; upload limits
and post-upload object verification; a client image and a workspace image section; and the avatar
and logo uploads reworked onto the shared primitives.

Excluded, each argued in ADR-0028 rather than overlooked: proposals and contracts, because they are
reachable from public token routes and every attached file would be an exposure decision rather than
a storage one; tasks and time entries, whose project can carry the file; and leads, which stay
light.

## How

One foreign key per parent rather than a polymorphic `entity_type` + `entity_id` pair. That makes
"an attachment belongs to precisely one record the requester can be checked against" a structural
fact Postgres enforces, rather than an application convention a forgotten `where` clause can undo —
which is the half of the security property that survives a mistake.

`attachments.upload_id` is `NOT NULL` and cascades, which is the deliberate exception to the rule
that every reference to `uploads` is `on delete set null`: an attachment whose upload is gone is not
a degraded attachment, it is nothing.

The download route authorizes through the parent record, following the invariant that `uploads`
carries no owner column and authorization comes from whoever references the blob.

The three `email_logs` writers were given a writer for `provider_message_id`, which until then had
neither a reader nor a writer.

## Evidence

- `database/schema/attachments.ts` and `chk_attachments_parent`; `database/schema/uploads.ts` — the
  file-top comment naming this exception
- `features/attachments/` — mutations, queries, services and `AttachmentsPanel`
- `app/api/attachments/[id]/route.ts`
- `components/ui/` file-upload primitives, `hooks/useFileUpload.ts`
- `lib/storage/limits.ts`, `lib/storage/verifyUploadedObject.ts`
- `database/schema/clients.ts` — `image_upload_id`; `database/schema/settings.ts` —
  `business_logo_upload_id`
- Panels wired in `features/clients/components/ClientWorkspace/`,
  `features/projects/components/ProjectWorkspace/`,
  `features/invoices/components/InvoiceDetailPage/`,
  `features/expenses/components/ExpenseFormSheet.tsx`
- `features/email/documentEmail.ts`, `features/proposals/publicResponse.ts`,
  `features/team/invitationEmail.ts` — the `provider_message_id` writers
- `docs/architecture/adr/0028-attachments-and-visual-identity.md`

## Verification

`features/attachments/__tests__/` covers the mutations, queries and the parent-authorization service
against a real Postgres, including the exactly-one-parent constraint.
`AttachmentsPanel/__tests__/AttachmentsPanel.test.tsx` covers the panel's states.
`lib/storage/__tests__/verifyUploadedObject.test.ts` covers post-upload verification.

Not covered by an automated test: the browser file-picker interaction and a real multi-file upload
against S3. Both are verified by hand against MinIO.

## Known gaps

Four gaps were left open at this delivery and none needed a schema change to start.

`clients.portal_token` is written and read by nothing; `/s/[token]` is described in `README.md`,
`docs/architecture/ARCHITECTURE.md` and `docs/architecture/SCHEMA.md`, and `proxy.ts`'s
`isPublicTokenRoute` already admits the prefix, but the route does not exist.

`line_items.source_time_entry_id` and `source_expense_id` are written only by the demo seeder; no
application path converts unbilled time or expenses into an invoice.

The `entity_type` enum cannot hold `lead`, `credit_note`, `recurring_invoice` or `client_contact`.

No orphan sweep exists for `uploads` rows whose referencing record was set to null. ADR-0028 records
that a sweeper job and checksum-based deduplication were both considered and rejected.
