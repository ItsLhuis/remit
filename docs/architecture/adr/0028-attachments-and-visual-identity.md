# ADR-0028: Attachments — one table, one foreign key per parent, private bucket

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

Remit stored files well and showed them badly. `uploads` is a clean content-addressed blob table and
several domains point at it, but every one of those references was a single nullable foreign key —
one avatar, one logo, one receipt, one rendered PDF. Nothing could carry a _second_ file. A
freelancer with a signed NDA, a brief, three reference images and a spec for one project had nowhere
to put any of them, and a client — the record they look at most — had no visual identity at all.

The upload interaction had also been rebuilt from scratch four times, in `AvatarSection`,
`LogoSection`, `ExpenseReceiptField` and `ImageBlockField`: four hidden file inputs, four presign
calls, four pending states, four error surfaces, four previews, and no shared primitive or hook
anywhere in `components/ui` or `hooks/`.

Two properties of `uploads` constrain everything below, and both are deliberate (see the file-top
comment in `database/schema/uploads.ts`): it carries **no owner column**, so authorization comes
from the referencing record rather than from the blob; and removing a row is a **hard delete**, so
every reference to it is `on delete set null`.

## Decision

**One `attachments` table with one nullable foreign key per attachable parent, plus
`chk_attachments_parent` asserting exactly one is set.** This is the shape `line_items` already
uses. Every parent link is a real foreign key Postgres enforces, and "an attachment belongs to
precisely one record the requester can be checked against" is a structural fact rather than an
application convention — which is the half of this stage's security property that a forgotten
`where` clause cannot undo.

The `line_items` precedent is weaker than it looks and is worth stating honestly: that table's three
parents are all _documents_, and these four are heterogeneous entities with different lifecycles and
different authorization stories. The **shape** matches; the analogy does not carry further than
that, and the argument below stands on its own merits rather than on the precedent.

**Attachable in v1: clients, projects, invoices, expenses.**

- **Clients** and **projects** are where a freelancer's reference material actually accumulates —
  briefs, brand assets, signed paperwork.
- **Invoices** carry the backup a client asks for when they query a line.
- **Expenses** already had a single `receipt_upload_id`; a trip with a flight, a hotel and three
  taxi receipts needed more than one. That column stays as the primary receipt and attachments are
  additional.

Excluded, each for a reason rather than an oversight:

- **Proposals and contracts** are reachable from public token routes. Every file attached to one
  would be an exposure decision rather than a storage decision, and the v1 answer is that no
  attachment is reachable anonymously.
- **Tasks and time entries** are children of a project that can carry the file, and neither has a
  surface where a file would be looked for.
- **Leads** stay light, following [ADR-0027](0027-contact-identity.md)'s precedent for pre-client
  records.

Joining that list later costs a reviewed migration. That is the point: joining is simultaneously a
bucket decision, an authorization decision and a limits decision, and a widening table makes each
one visible.

**Bucket: every attachment lands in the private `documents` bucket**, served only through
`app/api/attachments/[id]/route.ts`, which checks the session before reading and streams the object
through the app. A `documents` key is never handed to `resolveStorageUrl`. The client image of the
next decision is the one file this stage adds to the `public` bucket, in the same way an avatar or a
logo already is.

**Deletion is real removal.** `attachments.upload_id` is `NOT NULL` and `ON DELETE CASCADE` — the
one reference to `uploads` that cascades, against a codebase where every other one sets null. An
invoice or an expense is a record that must outlive its file; an attachment with its upload gone has
no filename, no size and no object, so it is not a record that lost its file, it is nothing at all.
Removing an attachment therefore deletes the row, the `uploads` row, and the stored object.
`uq_attachments_upload_id` is unique so two attachments can never share one upload, because removing
either would then destroy both. Parent foreign keys cascade for the same reason: an attachment whose
parent is gone has no record left to authorize a reader against. There is no `softDelete`: a user
who removes a file expects it gone, not hidden while the object stays readable to anyone holding its
key.

**Orphaned objects are accepted and not swept.** An object can outlive its row — a `PUT` that
succeeds while the follow-up write fails, a storage delete that fails after the row is gone. v1
ships no sweeper: a sweeper is a scheduled job that deletes user data based on the _absence_ of a
reference, and getting its query subtly wrong destroys files nobody asked it to touch. The failure
mode of no sweeper is wasted disk on a self-hosted box; the failure mode of a wrong sweeper is data
loss. The trade is deliberate and revisitable once there is evidence of how much space it actually
costs.

**Limits, enforced on the server and not only in the client:**

- **25 MB per file** — the ceiling most mail providers put on an attachment (Gmail's is exactly
  this), which is the size a freelancer already thinks of as "a file you can send". Deliberately
  larger than the 10 MB expense receipt, because a receipt is a phone photo and an attachment is a
  brief or a signed PDF.
- **20 files per record** — "infinite attachments" is the user's phrasing for "no small fixed cap",
  not for "no limit at all". An unbounded upload surface on a self-hosted box is an availability
  problem and an unbounded list is a read the panel cannot paginate.
- **100 MB total per record** — the number that actually protects the disk. Twenty files at the
  per-file ceiling would be 500 MB on one record; the count binds first for many small files, the
  total binds first for a few large ones.
- **A mime allowlist that excludes archives and SVG** — an archive defeats an allowlist by carrying
  anything inside it, and SVG is a script-execution vector in a bucket whose objects are served back
  with their declared type.

**A client gains `image_upload_id`**, shaped exactly like `settings.business_logo_upload_id`. The
column is named for what it holds rather than what it depicts, because a Remit client is a company
or a person and the same column serves a logo and a face.

**The fallback lives in `components/ui/EntityAvatar.tsx`, not in `features/clients`,** and renders
achromatic initials on `bg-muted`. Leads, contacts and team members will want the same fallback, and
deciding it once is cheaper than three near-identical versions. A colour derived stably from the
entity id was considered and rejected: DESIGN.md's Single Voice Rule permits indigo plus four
semantic states as the only chroma on screen, and a palette of identity colours is a second voice.

**`uploads` gains `checksum_sha256`**, measured server-side from the stored object together with
`size_bytes` by `lib/storage/verifyUploadedObject.ts`. A presigned `PUT` proves nothing about what
was actually written, so neither number is taken from the client. The checksum lets
`pnpm remit:restore` tell a truncated or substituted object from an intact one, which size alone
cannot.

**The migration history was squashed a second time.** `0000_initial_schema.sql` was regenerated from
the whole schema and the two hand-written migrations were re-created after it unchanged —
`0001_insert_only_guards.sql` (the insert-only triggers on `audit_logs` and `contract_signatures`,
including the single sanctioned `signed_pdf_upload_id` transition) and
`0002_document_parent_agreement.sql` (the five composite parent foreign keys of
[ADR-0026](0026-document-parentage.md)). Neither is reproducible by `pnpm database:generate`, and
losing either is a silent integrity regression nothing in the type system catches.

**A squash invalidates every existing database.** There is no upgrade path across one: replay is
keyed by migration hash and the old hashes no longer exist, so any developer or deployment on the
old history must reset and lose its data. This is safe only because v1 has not shipped, and it stops
being available the moment it has.

## Consequences

### Positive

- A record carries many files, and every parent link is a foreign key the database enforces rather
  than an id the application promises to keep valid.
- `chk_attachments_parent` makes cross-record reach a schema-level impossibility rather than a code
  review item: an attachment always names exactly one record, so "may this requester touch this
  file" reduces to a question already answered elsewhere.
- Nothing anonymous can reach an attachment, because no attachable entity has a public token route
  and every object is in the private bucket.
- One `FileDropzone`, one `FileUploadProgressList` and one `useFileUpload` replace four hand-rolled
  implementations, so the next feature that needs an upload writes none of it.
- Removing a file removes the file. There is no state where the row is hidden and the object is
  still readable by key.
- `checksum_sha256` makes a restore verifiable object by object.

### Negative

- The table widens every time an entity becomes attachable, and so does `chk_attachments_parent` and
  the mapping in `features/attachments/services/attachmentParent.ts`. A fifth parent is a migration,
  not a row in a lookup table.
- Orphaned objects accumulate silently and nothing reports how many there are. A self-hosted
  instance can only find them by listing the bucket.
- Attachments cost a round trip through the app to read, because they are streamed by a credentialed
  route rather than served by the object store. A large file is bounded by the app's throughput, not
  the bucket's.
- Proposals and contracts remain unattachable, which is the one place a freelancer most plausibly
  wants to hand a client an extra document. The workaround is the project or the invoice.
- The limits are hard numbers with no per-instance override. An operator with a large disk cannot
  raise them without editing code.
- The squash costs every existing database. Anyone tracking `main` between the two squashes has to
  reset.

## Alternatives considered

### One polymorphic table — `entity_type` + `entity_id` + `upload_id`

The cheapest to extend: a fifth attachable entity is a new enum value and nothing else. Rejected
because `entity_id` cannot carry a foreign key, so referential integrity becomes
application-enforced exactly where the security property lives. A dangling row would be prevented by
nothing, a hard delete of a parent would leave rows pointing at an id that no longer resolves, and
every read would have to remember to filter by `entity_type` — a forgotten predicate becoming a
cross-entity leak rather than a wrong result. [ADR-0026](0026-document-parentage.md) answered the
same question for document parentage by adding _more_ database-enforced integrity (composite foreign
keys with `ON DELETE SET NULL`), and reversing that reasoning one ADR later for the surface that
stores NDA-sensitive files is not defensible. The cheapness is also overstated: joining a new entity
is a bucket, authorization and limits decision regardless of whether the schema notices.

### A join table per entity — `client_attachments`, `project_attachments`, …

Real foreign keys with real cascade semantics, which is the property the polymorphic table loses.
Rejected because the metadata is _identical_ across all four parents — upload, title, uploader,
timestamps — so four tables would be four copies of one thing, plus four near-identical queries,
four inventory entries, four export-manifest decisions and four seed classifications. The
check-constraint shape buys the same integrity with one of each, and the widening it costs is a
single line per new parent.

### An `attachments.bucket` decision per attachable entity

Client and project files in the public bucket (cheap to serve, cheap to render) and invoice and
expense files in the private one. Rejected because the bucket would then encode a guess about
sensitivity that the user never made: a client's folder is exactly where an NDA or a contract scan
goes, and "public bucket" means anyone holding the key can read it forever. One private bucket for
everything makes the rule statable in a sentence, and the cost — a credentialed round trip — is paid
on a self-hosted box that is already serving the page.

### A colour derived from the entity id for the fallback avatar

The obvious candidate, and the one most products use: initials on a hue hashed from the id, stable
per entity and free to compute. Rejected against DESIGN.md's Single Voice Rule, which permits indigo
plus four semantic states as the only chroma on screen. A dozen identity hues would be the loudest
thing in a client list whose actual signal — overdue, at risk, paid — is carried by those four
states, and the fallback would compete with the data.

### An orphan sweeper job

A scheduled pass listing the bucket and deleting objects no row references. Rejected for v1 on the
asymmetry of its failure modes: wasted disk versus deleted user files, with a query whose
correctness depends on every future table that references `uploads` being remembered. `attachments`
is now the fifth such reference. When one is added and the sweeper is not updated, the sweeper
deletes live data — and it does so silently, on a schedule, against files the user cannot re-create.

### Checksum-based deduplication

Store one object per distinct `checksum_sha256` and let several attachments share it. Rejected on
two counts: it contradicts `uq_attachments_upload_id`, which exists so that removing an attachment
can delete its object without destroying somebody else's; and dedup keyed on a hash invites trusting
a client-supplied one, which would let a caller claim an object it never uploaded. The checksum
stays a verification record, not an identity.
