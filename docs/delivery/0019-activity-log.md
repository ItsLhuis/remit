# DR-0019: Activity log

- **Status:** Shipped
- **Date:** 2026-08-07
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0006
- **Supersedes:** —
- **Reconstructed:** yes

## What

A user-facing activity feed of what happened to business records, written from domain events and
rendered both as an instance-wide feed and as a per-entity timeline.

## Why

A freelancer coming back to a client after three months needs to know what happened: when the
proposal went out, when it was accepted, when the invoice was sent, when it was paid. Reconstructing
that from the records themselves means opening five pages and reading timestamps. The security audit
log is the wrong source for it — it records instance events for an investigator, not business events
for the person doing the work.

## Scope

Included: the `activity_logs` table, event handlers that write entries as domain events fire, the
instance-wide feed with unread state, the per-entity timeline embedded in client, project, invoice
and other detail surfaces, and message keys that translate at render time.

Excluded: user-authored notes or comments on the feed. It is a record of what the system observed,
not a discussion surface. Also excluded: writing entries directly from mutations — they go through
the event bus, so a feature that emits an event gets a feed entry without knowing the feed exists.

## How

Entries store a message **key** and its parameters rather than a rendered sentence. That is what
lets the feed change language without rewriting history, and `localeIndependence.test.ts` exists to
pin it: an entry written under one locale must render correctly under another.

Handlers are registered in `features/activityLog/events.ts` at module load and are thin and
non-throwing per ADR-0006. A feed write that failed must not fail the mutation that emitted the
event, because the business record is the thing that matters and the feed entry is not.

## Evidence

- `features/activityLog/` — `events.ts`, `mutations.ts`, `queries.ts`, `labels.ts`
- `database/schema/activityLogs.ts`, `database/schema/enums.ts` — the `entity_type` enum
- `lib/events/` — the typed bus and `EventMap`
- `components/ui/` — the `ActivityTimeline` primitive
- `app/(dashboard)/activity/`
- `docs/architecture/adr/0006-internal-event-bus.md`

## Verification

`features/activityLog/__tests__/events.integration.test.ts` covers handler registration and writes
against a real Postgres. `messageKeys.test.ts` asserts every emitted key exists in the translation
type. `localeIndependence.test.ts` asserts a stored entry renders under a different locale than the
one that wrote it. `queries.integration.test.ts` and `mutations.integration.test.ts` cover the feed
reads and unread state.

Not covered: that every domain event which should produce a feed entry has a handler. The `EventMap`
is typed but nothing asserts feed coverage over it, which is where the gap below comes from.

## Known gaps

The `entity_type` enum holds nine values and the handlers write eight of them. `lead`,
`credit_note`, `recurring_invoice` and `client_contact` are not in the enum at all, so those records
cannot appear in the feed without a migration. `task` is in the enum and is never written, so tasks
never appear despite being able to.
