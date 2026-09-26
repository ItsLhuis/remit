# ADR-0043: Built-in document layouts live in code and are resolved when no template exists

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

A new instance has no templates. Every invoice, proposal and credit note is drawn from a template
([ADR-0022](0022-pdf-rendering-engine.md)), so on a new instance each PDF builder found nothing to
render, returned, and left the chained mail unsent while the document was already marked sent and
its public link published. The templates page told the owner the missing types "fall back to the
built-in layout", which did not exist. A late fee reached a document only when the owner's own
template happened to place `invoice.lateFee`.

The fallback had to exist. Where it lives decides how it behaves over time, and there were two
candidates: a block tree per document type in code, used when the lookup finds no template; or
templates seeded into the `templates` table at setup and by a migration for existing instances,
marked `is_system`.

## Decision

**The built-in layouts are code.** `features/templates/services/builtInLayout.ts` builds a block
tree for an invoice, a proposal or a credit note, and `features/templates/documentLayout.ts`'s
`resolveDocumentLayout` is the one place a document's layout is chosen: the document's own template,
else the instance default for its type, else the built-in. Every PDF builder asks it. A template
whose canvas is empty counts as none, because it would render a blank money document.

**One renderer.** The built-in is an ordinary block tree handed to `renderTemplate`, so the preview
and PDF path of ADR-0022 and its sanitizer are unchanged. Every figure reaches the page as a merge
token; the layout decides only placement.

**Shaped by the document.** Unlike a stored canvas, the built-in knows the document it renders: it
sizes the line-items table to the lines, places the totals below it, and leaves out a line whose
amount does not apply — a late fee nobody was charged, a credit nothing issued — rather than
printing an empty or zero row. Its labels come from `templates.builtInLayout.*`, and it follows
`DESIGN.md`.

**Contracts have none.** A contract snapshots its own blocks at authoring time and cannot be sent
without them, so it never renders from a template and a built-in could only invent legal terms. The
templates page says that contracts need a template of their own.

## Consequences

### Positive

- Every document type that renders from a template renders on an instance that has none, so a send
  always has a document to chain its mail behind.
- A layout improved in a later version reaches every instance that has not chosen its own, with no
  data migration and nothing to reconcile with an owner's edits.
- A restore of an archive taken before this decision, a data reset, or an owner deleting every
  template cannot leave an instance without a layout.

### Negative

- The built-in is not listed on `/templates` and cannot be duplicated as a starting point; an owner
  who wants to adjust it builds a template of their own.
- `templates.is_system` and the interface that reads it — the system badge, the protection from
  deletion, the origin filter — have no writer under this decision.
- A sent document keeps the layout of the version that rendered it, because the stored PDF is the
  snapshot; only a later render picks up a changed built-in.

## Alternatives considered

### Seed system templates into the database

Seeding would have used `is_system` as intended and put the built-ins on `/templates`. It was
rejected because the rows would be a copy frozen at seed time: an improvement would reach no
existing instance without a second migration, and one that met an owner-edited system template would
have to choose whose version wins. The seed would also have to run at setup, in a migration for
existing instances, and after a restore of an older archive or a data reset that removed it — four
places to keep in step, each of which could leave an instance with no layout again. The layouts
themselves would still have had to be written in code to seed them, so the database copy added state
without removing any.

### Withdraw the claim

Leaving documents unrendered and changing the templates page to say so would have kept a new
instance unable to send an invoice. It was rejected because the product already told the owner the
fallback exists, and nothing should ship that fails its first send.
