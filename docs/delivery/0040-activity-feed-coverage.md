# DR-0040: Activity feed coverage

- **Status:** Shipped
- **Date:** 2026-09-08
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0006, ADR-0010, ADR-0015, ADR-0027
- **Supersedes:** —

## What

The activity feed can name every entity it should: a converted lead, an issued credit note and an
exhausted retainer now appear in it, and the one type nothing wrote is gone.

## Why

`entity_type` held nine values and the feed wrote eight of them. A lead, a credit note and a
recurring schedule had no member at all, so three domain moments the product treats as significant —
a prospect becoming a client, money moving back toward one, a retainer running out mid-period —
could not be stored, however the handler was written. The column was the limit, not the code.

The ninth value was the mirror image. `task` was permitted, translated and offered in the feed's
type filter, and nothing had ever written it, so filtering by it returned an empty page every time.
A permitted-but-unwritten value and an unwritable domain noun are the same defect seen from either
side: the enum and the feed did not agree in either direction.

## Scope

Included: three new `entity_type` values with the handler that writes each, the removal of `task`,
the messages and labels they render through, their link targets, and the documentation that
describes the enum.

Excluded, each for a reason:

- **Intermediate lead stages** (`lead.stage_changed`). Five per lead, and the leads board already
  shows and filters on that status. Announcing them would crowd out the documents and money the feed
  exists to show. The terminal moment is the conversion, and that is the row.
- **Lead creation** (`lead.created`). A lead is a note to self at the top of the funnel; announcing
  intake fills the feed with rows the reader has just typed.
- **Tasks.** The highest-volume record in the product, and `ARCHITECTURE.md` section 1 states Remit
  is not a project management platform. Silence was already the shipped behaviour; this makes it
  structural by removing the value rather than documenting the exception.
- **Deletions** (`credit_note.deleted` and every other `*.deleted`). The feed announces no deletion
  for any entity; adding one for credit notes alone would be the inconsistency.
- **Client contacts.** ADR-0027 makes a contact a capability of a client rather than an entity, and
  there is no route a feed row could link to.
- **A second row for a generated recurring run.** The invoice row already announces it.

## How

The enum change is a type recreate rather than `ALTER TYPE ... ADD VALUE`, because a value was
removed as well as added. That is what `pnpm database:generate` produced from the schema edit
(`drizzle/migrations/0007_tricky_dragon_lord.sql`), and it has a property the additive form does
not: PostgreSQL 16 leaves a value added by `ADD VALUE` unusable until its transaction commits, while
a recreated type is usable immediately, so the migration is safe under the single transaction
`scripts/migrate.ts` applies it in. It is only safe to drop `task` because nothing ever wrote it —
no row could hold the value being removed.

Two decisions in `features/activityLog/events.ts` are not visible from the code alone:

A conversion writes two rows, not one. `convertLeadToClient` reaches `createClient`, which emits
`client.created`, and the new handler adds a `lead` row beside it. That is not the duplicate this
work set out to avoid: they are two facts about two records with two click-throughs — a pursuit
ended, and a client now exists — and it is the same shape as a settling payment already writing both
a `payment` and an `invoice` row. The duplicate that was avoided is the other one: a generated
recurring run stays filed under the invoice it produced, and the schedule earns a row only for
retainer exhaustion, which is a fact the invoice does not carry.

`message_args` carries no money, in any new message. `invoiceLateFeeApplied` and `paymentReceived`
already established why: the feed renders no currency, so an amount beside a row from a client
billed in another currency reads as the wrong figure. The credit note therefore names both document
numbers and no total. Everything stored is an identifier, a name, or a raw number that ICU formats
at read time — never a formatted string, which would freeze one locale's separators into history and
defeat the reason the column stores keys and arguments at all (ARCHITECTURE.md section 15).

`formatLeadName` reaches the handler through `features/leads/server.ts`, not the feature's root
barrel. The root barrel re-exports the feature's React components, and this file is bundled into
`scripts/dist/worker.js`; four other features already export pure services through `server.ts` for
the same reason.

## Evidence

- Enum and migration: `database/schema/enums.ts`, `drizzle/migrations/0007_tricky_dragon_lord.sql`.
- Handlers and builders: `features/activityLog/events.ts` — `lead.converted`,
  `retainer.pool_exhausted` and `credit_note.issued`, beside the fifteen that existed.
- Emitters, all of which already existed and needed no change: `features/leads/mutations.ts`
  (`convertLeadToClient`), `features/creditNotes/mutations.ts` (`createCreditNote`),
  `features/recurringInvoices/jobs.ts` (`announceGeneration`).
- Surface: `features/activityLog/labels.ts` for icons, entity labels and link targets;
  `features/activityLog/schemas.ts` for the tuple the type filter is generated from.
- Messages: `lib/i18n/types.ts` and `lib/i18n/locales/en.tsx`.
- Cross-feature export: `features/leads/server.ts`.
- Tests: `features/activityLog/__tests__/events.integration.test.ts` (six new cases),
  `features/activityLog/__tests__/labels.test.ts` (new file),
  `features/activityLog/__tests__/schemas.test.ts`.
- Documentation: `docs/architecture/ARCHITECTURE.md` section 8, `docs/architecture/SCHEMA.md`
  sections 6 and 30.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test` (243 files, 2169 tests), `pnpm test:integration` (78
files, 781 tests) and `pnpm build` all pass. react-doctor scores 88 with no errors, and fallow
reports nothing new; `getActivityEntityHref` was flagged CRITICAL at CRAP 110 with no coverage
before this work and is no longer critical, because the new `labels.test.ts` pins every link target.

The migration was verified against a populated table rather than an empty one. A throwaway database
was built carrying the pre-change nine-value enum and five `activity_logs` rows, the migration was
applied to it in a single transaction, and all five rows, the `NOT NULL` and the
`(entity_type, entity_id)` index survived; a `lead` row inserted immediately afterwards confirmed
the new values are usable in the same connection.

Not covered: the feed was not exercised by hand in a browser, so the three new rows, their icons and
their link targets are verified by test rather than by sight, and no end-to-end run drove a real
recurring generation through the queue to watch a single row appear. The three link targets are
asserted as strings, not resolved against the router.

## Known gaps

- A feed row links to an entity that may since have been soft-deleted, and the detail route it
  reaches will not resolve. This is unchanged from the eight types that shipped before and was left
  unchanged deliberately rather than special-cased for the three new ones.
- `features/activityLog/events.ts` is 466 lines against a 500-line ceiling. The next handler added
  to it will need the file split by emitting feature.
- A credit note row links to the global credit-note list rather than the note itself, because the
  detail route lives under its invoice's project and a feed row carries no parent ids.
- A client contact still cannot appear in the feed. That is deliberate under ADR-0027, but it is the
  one domain noun the enum cannot name.
