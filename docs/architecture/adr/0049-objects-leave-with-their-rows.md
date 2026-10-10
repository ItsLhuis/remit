# ADR-0049: Stored objects leave with the rows that owned them

- **Status:** Accepted
- **Date:** 2026-10-08
- **Supersedes:** [ADR-0034](0034-retention-and-erasure.md) on one point, "neither the purge nor an
  erasure deletes a storage object", and [ADR-0025](0025-instance-data-reset-scope.md) on two,
  "object storage is untouched" and "document numbering is not rewound". Every other point of both
  stands, including ADR-0028's rejection of an orphan sweeper.

## Context

ADR-0025, ADR-0028 and ADR-0034 each declined to delete stored objects for the same reason: an
object delete cannot join a database transaction, so a failure after the files were gone would
report a rolled-back operation over destroyed data. The consequence was that a client's erasure left
their attachments, documents and export archives readable in the bucket, the retention purge
reclaimed rows and never disk, and export artifacts were never removed at all. An erasure that
leaves the subject's files behind is not an erasure.

The reset had a second, independent defect. The demo seed numbers its documents from 1 and, on an
instance that already had a settings row, never moved the counters, so the first real invoice after
seeding collided with a seeded number.

## Decision

**Objects are released in the transaction and deleted after it.** A purge, an erasure, an instance
reset and an export expiry each write one row per released object into `object_deletions` in the
same transaction as their row deletes, and remove the object from the bucket only after the commit
(`lib/storage/objectDeletions.ts`). The only state a failure can leave is a row gone with its object
still present, which the next drain finishes: immediately after the commit, and then hourly from
`storage.deletion.sweep`. An object is never gone while a row still names it.

**A released upload is the difference between two reads of every reference.** Before its deletes the
transaction reads every upload id anything references — every foreign key to `uploads` from the
catalogue, image blocks inside `templates.blocks` and `contracts.blocks`, and avatars stored as keys
on `users.image` — and reads them again afterwards. The uploads in the first set and not the second
lost their last reference to this operation, cascades included, and only those are deleted. The
transaction runs at repeatable read so the two reads share one snapshot and another session's writes
cannot enter the difference. An upload nothing referenced before the operation is never in the first
set, which is what keeps this from being the orphan sweep ADR-0028 rejected.

Listing the columns a deleted row carries was rejected: an invoice's credit notes and attachments
leave through `ON DELETE CASCADE`, and a list would have to restate every cascade and drift from the
schema.

**Export artifacts expire after a fixed week.** Both `data_exports` and `report_exports` rows, and
their objects, are removed by the nightly retention sweep seven days after they finish; an expired
artifact's download answers as a missing one. A setting was rejected as a number nobody asked to
tune; tying the lifetime to the retention windows was rejected because those govern how long a
deleted record is legally held, default to never, and would keep every archive forever on a default
instance.

**The reset rewinds only what the demo seed advanced.** The seed moves each counter past the numbers
it issues and records the counters before and after in its `instance.seed_demo.completed` audit
entry. A reset or reseed puts a counter back to its pre-seed value only when it still holds exactly
the value the seed left — that is, when no number has been issued since. A counter that moved on may
have issued a real number that is in a client's inbox, and re-issuing it remains the accounting
hazard ADR-0025 refused. Rewinding every counter to 1 was rejected for exactly that reason.

## Consequences

### Positive

- An erasure removes the subject's files; a purge reclaims disk; an export archive stops existing a
  week after it was made.
- No path deletes an object a live row references, and none leaves a row pointing at a missing one.
- Seeding a set-up instance no longer breaks invoice numbering, and a reset after a demo returns the
  counters the demo moved.

### Negative

- Purges, erasures and resets run at repeatable read, so a write that touches the same rows at the
  same moment fails them; the job retries and the owner can retry an erasure.
- An object can outlive its row by up to an hour while the store is unreachable, and indefinitely if
  the store keeps refusing one key; the queue keeps it and the drain logs the count.
- A reference to an upload that is neither a foreign key, a block tree nor an avatar key would not
  be seen. Adding one means adding it to `readUploadReferences`.

## Alternatives considered

### An orphan sweep

Rejected by ADR-0028 and not reopened: it decides from the absence of a reference, and a missed
reference deletes live data.

### Deleting objects before the commit

Simpler and wrong: a later failure rolls back the rows over files already gone.
