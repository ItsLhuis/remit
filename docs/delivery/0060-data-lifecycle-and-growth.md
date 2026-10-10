# Data lifecycle and growth

- **Status:** Shipped
- **Date:** 2026-10-10
- **Verdict:** Complete
- **Decisions:** ADR-0010, ADR-0025, ADR-0028, ADR-0034, ADR-0049
- **Supersedes:** —

## What

Data that stops being current leaves the instance completely and on a schedule the owner can read:
stored objects go with the rows that owned them, export artifacts expire, the trash dates and pages
every record truthfully, and the surfaces that grew without bound — the client portal, the
rate-limit audit trail, the activity feed's links — are bounded or resolve.

## Why

The retention purge and a client's erasure deleted rows and left every file those rows owned in the
bucket, so an erased client's attachments and documents stayed readable to anyone with bucket
access. Report and data export artifacts were never removed. The demo data reset left its objects
behind and, on an instance set up before seeding, the seed never advanced the numbering counters, so
the first real invoice collided with a seeded number.

The trash dated a client by its own window although documents naming it hold it far longer, listed a
countersigned contract with a removal date that never arrives, gave no warning before an erasure a
signed contract would refuse, and stopped at 200 rows. The client portal listed every document a
client was ever sent. Every request a tripped rate limit refused wrote its own audit row, so a flood
from one address was a flood of rows. And an activity-feed row linked to a record that may since
have been deleted, while a credit note linked to the global list rather than to the note.

## Scope

Included: object deletion for the retention purge, a client's erasure, the instance data reset and
expired export artifacts; a fixed export artifact lifetime; a seed-aware counter rewind; one purge
rule shared by the trash and the purge; trash explanations, an erasure pre-check and server-side
trash paging; client portal paging; windowed rate-limit audit entries; a measurement of the billing
append path; feed links that resolve or say why they cannot.

Excluded, deliberately: a sweep of unreferenced objects (ADR-0028 rejected it and the owner has not
reopened it), audit-log retention, and who an export belongs to — each an open owner decision.

## How

Objects are released, never deleted, inside the transaction that deletes their rows. The purge, the
erasure, the reset and export expiry write one `object_deletions` row per released object in that
transaction and remove the objects only after it commits, so a failure can leave a row gone with its
object present, which the next drain finishes, and never the reverse (ADR-0049). Which uploads a
delete released is computed rather than listed: every reference is read before the deletes and again
after them, and the uploads in the first set and not the second are the ones this delete left
unreferenced. That catches what cascades remove without restating the cascades, and it leaves alone
any upload nothing referenced to begin with, which is what keeps it from being the orphan sweep
ADR-0028 rejected. The two reads must share one snapshot, so these transactions run at repeatable
read.

The trash and the purge now decide with one pure rule, `resolvePurgeSchedule`. The purge reads the
rows its window cutoff could admit and lets the rule pick the due ones, remembering the documents it
has already chosen so a client they name is judged as the purge will find it, after they are gone.
The trash dates each row on its page with the same rule, which is how a countersigned contract says
it is never removed, a client held by its documents shows their later date, and a client a live
document names says so instead of showing a date.

The demo seed numbered its documents from 1 but moved the counters only when it created the settings
row, so on any instance that had finished setup the first real invoice collided with a demo one. The
seed now moves every counter past what it used and records the counters before and after; the reset
rewinds a counter to its pre-seed value only while it still holds exactly the seed's value.

The rate-limit audit counts refusals per key per window in Redis with one atomic script, falling
back to a per-process counter while Redis is down; only the first refusal of a window writes a row,
and that row carries how many the key's previous window suppressed. Measuring the billing append
path found a hard ceiling rather than a slow one: the totals update bound four parameters per line,
and Postgres refuses a statement past 65,535, so an append failed at 17,000 existing lines and
billing a selection of 6,000 entries failed outright (both measured). The totals now travel as four
arrays unnested in SQL and the inserts are batched.

One defect inside the purge was fixed on the way: its audit entry went through `writeAudit`, which
inserts on its own connection, so a purge that rolled back still left an entry claiming it had run.
It is now written through the purge's transaction.

## Evidence

- Object release and drain: `lib/storage/objectDeletions.ts`, `lib/storage/objectOwnership.ts`;
  table `database/schema/objectDeletions.ts`, migration
  `drizzle/migrations/0012_silent_silver_centurion.sql`; hourly retry in `features/trash/jobs.ts`
  (`storage.deletion.sweep`, `lib/jobs/schedules.ts`).
- Purge and shared rule: `features/trash/purge.ts`, `features/trash/purgeFacts.ts`,
  `features/trash/services/purgeSchedule.ts`.
- Erasure: `features/clients/forget.ts` (`forgetClientWrite`, `listErasureBlockingContracts`),
  `features/clients/forgetMutations.ts`, `features/clients/components/ForgetClientDialog.tsx`.
- Export expiry: `features/dataExport/services/artifactExpiry.ts`,
  `features/dataExport/systemWrites.ts`, `features/reports/systemWrites.ts`, the expiry checks in
  `getDataExportArchive` and `getReportExportArtifact`.
- Reset and seed: `scripts/core/domainData/deleteDomainRows.ts`, `numbering.ts`,
  `numberingCounters.ts`, `scripts/core/resetData/runResetData.ts`,
  `scripts/core/seedDemo/runSeedDemo.ts`.
- Trash surface: `features/trash/queries.ts`, `features/trash/schemas.ts` (`parseTrashListQuery`),
  `features/trash/components/TrashSection/`.
- Portal paging: `features/clients/publicQueries.ts`, `features/clients/services/portalPaging.ts`,
  `features/clients/components/PublicClientPortalPage/PortalPager.tsx`.
- Rate-limit audit: `lib/rateLimit/tripWindow.ts`, `lib/rateLimit/tripCounter.ts`,
  `lib/audit/index.ts` (`writeRateLimitTripAudit`), applied at all fourteen refusal sites.
- Billing: `features/invoices/invoiceWrites.ts`.
- Feed links: `features/activityLog/services/activityTarget.ts`, `features/activityLog/queries.ts`,
  `features/activityLog/components/ActivityFeedPage/ActivityTargetLink.tsx`.
- Tests: `features/trash/__tests__/purge.integration.test.ts`,
  `features/trash/__tests__/trashQueries.integration.test.ts`,
  `features/trash/services/__tests__/purgeSchedule.test.ts`,
  `features/clients/__tests__/forget.integration.test.ts`,
  `features/clients/components/__tests__/ForgetClientDialog.test.tsx`,
  `features/clients/__tests__/publicPortal.integration.test.ts`,
  `features/dataExport/__tests__/expiry.integration.test.ts`,
  `lib/storage/__tests__/objectDeletions.integration.test.ts`,
  `lib/storage/__tests__/objectOwnership.test.ts`, `lib/rateLimit/__tests__/tripWindow.test.ts`,
  `lib/audit/__tests__/rateLimitTrip.integration.test.ts`,
  `features/invoices/__tests__/billingScale.integration.test.ts`,
  `scripts/core/resetData/__tests__/resetData.integration.test.ts`,
  `scripts/core/domainData/__tests__/numbering.test.ts`,
  `features/activityLog/services/__tests__/activityTarget.test.ts`.
- Decision: `docs/architecture/adr/0049-objects-leave-with-their-rows.md`.

## Verification

On 2026-10-10: `pnpm typecheck` clean; `pnpm lint` with no errors and only the two `max-lines`
warnings it already reported on files this work does not touch; `pnpm format:check` clean;
react-doctor 91 with no finding introduced in a touched file. The fallow audit against the base
commit gated none of its complexity findings, which score IO functions against unit coverage they
cannot have because their tests are integration tests; its duplication is the public token routes'
shared shape, which predates this work; and its one unused type export predates it too.
`pnpm test:coverage` passed 326 files and 2,796 tests with the services threshold met;
`pnpm test:integration` passed 105 files and 954 tests in one run; `pnpm vitest run tests/docs`
passed 20 tests; `pnpm build` succeeded. `pnpm test:e2e` against the production build passed 27
tests and skipped the registration spec, which skips by design on an instance that already has an
owner; the proposal flow failed for want of a running job worker, as it always does locally, and
passed when rerun with `pnpm dev:worker` up. The billing measurements are the ones in How,
regression-tested by `billingScale.integration.test.ts`.

A manual smoke ran against the development stack with the bundled object store, each object checked
in the bucket. Erasing a client removed its image, attachment, invoice PDF and data export archive,
and kept a PDF a second client's invoice still named, with its upload row. A purge with the storage
container stopped deleted three clients, queued their three objects with one attempt each, and the
worker's `storage.deletion.sweep`, run after the container restarted, emptied the queue and the
bucket. An expired data export and report export answered their download routes with the same 404
body as an unknown id, and the expiry sweep removed both rows and both objects. Thirty requests to
the proposal OTP route from one address were refused 25 times and wrote one audit entry; with the
audit window closed early by deleting its Redis key, the next refusal wrote the second entry
carrying 24 suppressed. In the browser the trash dated a client held by a deleted invoice at the
financial window's year, showed a deleted countersigned contract as never removed, dated leads by
their window and paged past 210 rows; the erasure dialog for a client named by two signed contracts
named both before confirmation; the portal paged 25 invoices across three pages; the feed marked a
deleted client's row deleted with a link into the trash, and a credit note's row opened the note.

Not covered: the rate-limit carry was observed by closing the window by hand rather than waiting
fifteen minutes; the store was stopped before the purge began rather than between two deletes, so
every delete in the drain failed rather than some; the portal's outstanding total was rendered only
for zero-value invoices, and its sum over every owed invoice rests on
`publicPortal.integration.test.ts`; no component review agent was available to run over the diff.

## Known gaps

None.
