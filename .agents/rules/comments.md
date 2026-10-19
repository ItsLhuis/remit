# Comment Rules

Code explains itself through naming, extraction and types. A comment is a second artifact that can
drift from the code beside it, so write one only when the code cannot carry the information — and
then write it well. Remit is built by agents with no memory between sessions: a comment recording a
non-obvious "why" is the only project memory that sits permanently next to the code it explains, and
noise is what future readers learn to skip. Durable "why" belongs in code; transient "how we got
here" does not.

## A comment must earn its place

Write one only when it carries at least one of these, and the code cannot:

- **A non-obvious invariant** that must stay true and would look arbitrary otherwise.
- **A cross-file contract** between two modules where the other side is not visible from here. Name
  the other file or function.
- **A deliberate, counter-intuitive decision** — why the obvious approach was rejected, why an
  ordering matters, why a value is not memoized, why a failure is swallowed.
- **Genuinely complex logic** — geometry, parsing grammars, coordinate-space conversions, arithmetic
  a reader would otherwise re-derive.
- **A trust or safety boundary** — where a value stops being untrusted, why a shell spawn is safe,
  why a rollback is best-effort.

Everything else is answered by a better name or an extracted function. Reach for those first.

## Where comments belong

Omitting a load-bearing "why" is a failure exactly as writing noise is. These are the sites where
justified comments cluster; reaching one is a prompt to ask the question, and most visits correctly
end with nothing.

| Layer               | Look for                                                                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/*.ts`     | Where rounding happens and why once rather than per line; why a status transition is refused; date-window and next-run math a reader would re-derive                                                                 |
| `mutations.ts`      | An ordering between two writes that looks arbitrary and is not; why a failure is swallowed; why a rollback is best-effort; emit-after-write and revalidation order                                                   |
| `queries.ts`        | Soft-delete visibility that differs from a sibling read; a status derived in SQL that must agree with a badge; an encrypted column reaching a client-bound read model                                                |
| `schemas.ts`        | A bound that silently restates a database check constraint; a resolver contract (`raw: true`) and any deliberate exception to it                                                                                     |
| `database/schema/`  | The business reason behind `set null` versus `cascade`; insert-only enforced by a migration trigger; a partial index that is the structural form of a domain rule; a column typed for an external library's contract |
| Public token routes | Constant-time comparison; the enumeration-defeating response shape; the rate-limit key; why a body or response is cloned before being consumed                                                                       |
| `.tsx`              | Only the four categories in "Components and JSX" below                                                                                                                                                               |
| `scripts/`          | Data-loss safety; what makes a run resumable or a re-run a no-op; lock and connection semantics                                                                                                                      |
| `__tests__/`        | A pin that is load-bearing rather than leftover (a fixed time zone, a frozen clock); a hardcoded list that is itself the guard and must not be derived                                                               |
| Config              | A setting whose removal silently breaks a different file                                                                                                                                                             |

## Before you finish

Judge a feature's comments against the feature, not a quota. When a feature ends with very few,
check it by asking which of these it has, ordered by how easily each is missed:

- An anonymous or public read model that deliberately omits an id or a bearer token.
- A field that must travel only because a pure service needs it to derive something.
- A value snapshotted at issue time and deliberately frozen afterwards.
- A status derived at read time that a second site restates.
- An encrypted column that reaches a read model rather than staying inside a server-only adapter
  (the one that hides best: the column looks ordinary at the read site).
- A type or helper that lives where it does because a directive or an import boundary forbids the
  obvious home.

A feature with none of these earns almost no comments, and saying so is a complete answer.

## Try a name before a comment

A comment explaining what a condition means is a rename waiting to happen: extract the predicate
(`if (isCollectable(invoice, paidCents))`) and delete the comment. A comment above a block survives
only when the "why" it carries would still be missing after naming the block — a rejected
alternative, an external constraint, an ordering that looks arbitrary. If the comment cannot be
written clearly, refactor first.

## Anti-patterns

Do not write a comment that:

- **Narrates the next line** (`// Set the status to paid`).
- **Restates a name or a type.**
- **References a transient artifact**: a plan, a prompt, `docs/prompts/**`, a ledger, a progress
  file, a stage/phase/milestone number, a session, a reviewer conversation, a mockup. Those rot
  silently. The encouraged opposites are durable: a **source file and symbol**
  (`services/constraints.ts`'s `applyFrameResize`), and a **standing specification document**
  (`docs/architecture/ARCHITECTURE.md`, `SCHEMA.md`, `DESIGN.md`, a capability spec under
  `openspec/specs/`, or a rule under `.agents/rules/`). Name the decision, not just the file:
  `integer minor units, never floats — see money-and-dates.md` over `see money-and-dates.md`.
- **Justifies a change to a reviewer** — that is a commit message.
- **Records a changelog or an author** — `git log` and `git blame` answer both.
- **Is a divider or a banner** (`// ===== HELPERS =====`). Column-group comments in large
  `database/schema/` tables are the one sanctioned exception.
- **Is a joke, an initial or a personal note.**
- **Is commented-out code.** No exceptions.
- **Is a `TODO`/`FIXME` marker.** Incomplete work does not ship to `main` (see `AGENTS.md`);
  register it in `openspec/backlog.md` instead.
- **Exists to fill a file.** A file with nothing non-obvious to say correctly has no comments.

## Keeping comments true

A comment and the code it describes change together, in the same edit. A change that invalidates a
comment updates or deletes it before it lands. Nothing validates comment text, and a reader who
finds one lying comment learns to skim all of them; when in doubt about a comment you did not write,
verify it and delete it if it no longer holds.

## No JSDoc

Use plain `//` line comments; never `/** ... */` blocks or `@param`/`@returns`/`@type` tags. JSDoc
earns its keep at a published API boundary with callers who cannot read the implementation; Remit is
one self-hosted application with every consumer in this repo and no docs generator, and the tag
vocabulary mostly restates types that TypeScript strict mode and Zod already state. Revisit only for
a package published under `packages/`. Multi-line explanations use stacked `//` lines wrapped at the
printer width.

## Placement and form

- A comment about a whole module sits at the top of the file, below the imports.
- A comment about an export sits immediately above it.
- A comment about one line or expression sits immediately above that line, inside the function.
- Prose, sentence case, full sentences. Reference other files by path or function name.
- An `eslint-disable` or other suppression carries a one-line reason stating why the code cannot
  change. A suppression with no reason is not acceptable.

## Components and JSX

`.tsx` files earn materially fewer comments: domain rules live in `services/`, validation in
`schemas.ts`, and markup states its own structure. Comment a component only for:

- **A deliberate accessibility deviation** — an element carrying a role or `aria-*` value its markup
  would not imply, or a keyboard affordance that differs from the primitive's default.
- **A render-cost decision** — why a value is or is not memoized, why a row is `memo`'d, why a
  `useWatch` names the fields it does (`components.md`).
- **A third-party quirk or workaround** — a Radix, dnd-kit or react-hook-form behaviour whose
  workaround would silently break something if removed.
- **A deliberate escape from the design system** — raw markup where a `components/ui` primitive
  exists (`components.md`).

Layout, markup structure, class names, conditional rendering and prop wiring get none.

## Calibration checklist

Apply to each comment, written or reviewed. Any "yes" in the first three means it does not ship.

1. Does the code already say this through its name, type or structure?
2. Would a better name or an extracted function remove the need?
3. Is it true only of today's implementation rather than of the contract?
4. Is it still true of the code beside it, right now?
5. Does it name a category from "A comment must earn its place"?

Deleting a comment that fails this is a success, including one written minutes earlier.

Reference examples: the `BlockIndexEntry` comment in `features/templates/services/blockIndex.ts`
(cross-file contract plus invariant) and the `parseTokens` grammar comment in
`features/templates/services/expression.ts` (complex logic).
