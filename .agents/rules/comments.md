# Comment Rules

Code explains itself through naming, extraction, and types. A comment is not free documentation: it
is a second artifact that can drift from the code beside it. Write one only when the code genuinely
cannot carry the information on its own — then write it well, because in this repository a comment
is also the only project memory that survives a context reset.

## Why this rule is stricter here

Remit is built almost entirely through AI coding agents with no memory between sessions. Plans,
prompts, and chat history all evaporate; the file does not. A comment recording a non-obvious "why"
sits permanently next to the exact code it explains and is read by every future agent, whichever
model it is. That makes a justified comment worth more here than in a human-only codebase — and an
unjustified one worse, because noise is what future readers learn to skip.

The corollary: durable "why" belongs in code, transient "how we got here" does not. Task
traceability lives in `docs/prompts/**` and plan/progress files, never in a comment.

## A comment must earn its place

Write one only when it carries at least one of these, and the code cannot:

- **A non-obvious invariant.** Something that must stay true and would look arbitrary otherwise.
- **A cross-file contract.** Two modules that must agree, where the other side is not visible from
  here. Name the other file or function so the reader can follow it.
- **A deliberate, counter-intuitive decision.** The "second intention" — why the obvious approach
  was rejected, why an ordering matters, why a value is not memoized, why a failure is swallowed.
- **Genuinely complex logic.** Geometry, parsing grammars, coordinate-space conversions, arithmetic
  a reader would otherwise have to re-derive.
- **A trust or safety boundary.** Where a value stops being untrusted, why a shell spawn is safe,
  why a rollback is best-effort.

Everything else is answered by a better name or an extracted function. Reach for those first.

## Where comments belong

The section above says what a comment must carry. This one says where to look for one, because the
rest of this file is mostly a list of things not to write, and a rule read as pure prohibition
produces a codebase that under-comments by default. Omitting a load-bearing "why" is a failure in
exactly the same way writing noise is.

These are the sites where this repository's justified comments actually cluster. Reaching one of
them is a prompt to ask the question, never an instruction to write something: most visits still end
in nothing, and that is the correct outcome.

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

A feature's comments are judged against the feature, not against a quota. When a whole feature ends
with very few, that is usually correct — but check it rather than assume it, by asking which of
these it actually has:

- An anonymous or public read model that deliberately omits an id or a bearer token.
- A field that must travel only because a pure service needs it to derive something.
- A value snapshotted at issue time and deliberately frozen afterwards.
- A status derived at read time that a second site restates.
- An encrypted column that reaches a read model rather than staying inside a server-only adapter.
- A type or a helper that lives where it does because a directive or an import boundary forbids the
  obvious home.

A feature with none of these earns almost no comments, and saying so is a complete answer. The list
is ordered by how easily each is missed: the encrypted column reaching a read model is the one that
hides best, because the column looks ordinary at the read site and its decryption happens elsewhere.

## Try a name before a comment

A comment explaining what a condition means is a rename waiting to happen. The name travels with
every call site, survives an extraction, and cannot drift; the comment does none of that. Extract
the predicate and delete the comment.

```ts
// Bad - the comment carries the meaning and only this call site benefits
// An invoice is collectable once it has been sent and is not fully settled
if (invoice.status === "sent" && paidCents < invoice.totalCents) {

// Good - the meaning is in a name, reusable and checked by the compiler
if (isCollectable(invoice, paidCents)) {
```

The same test applies to a comment above a block: if the block can become a named function, name it.
A comment survives that test only when the "why" it carries would still be missing after the rename
— a rejected alternative, an external constraint, an ordering that looks arbitrary.

If the comment cannot be written clearly, that is a signal about the code, not about your prose.
Refactor first and write the comment afterwards, when there is less of it to explain.

## Anti-patterns

Do not write a comment that:

- **Narrates the next line.** `// Set the status to paid` above `status: "paid"`.
- **Restates a name or a type.** The signature already says it; TypeScript strict mode enforces it.
- **References a transient artifact.** A plan, a prompt, `docs/prompts/**`, a ledger, a progress
  file, a stage/phase/milestone number, a session, a reviewer conversation, a mockup. Those are
  rewritten or deleted without the compiler, a grep, or a test ever noticing, so the reference rots
  silently and the reader has nothing left to follow.

  Two kinds of reference are the opposite and are encouraged, because both are durable, versioned,
  greppable, and reviewed: a **source file and symbol** (`services/constraints.ts`'s
  `applyFrameResize`), which breaks visibly on rename; and a **standing specification document** —
  `docs/architecture/ARCHITECTURE.md`, an ADR under `docs/architecture/adr/`, `SCHEMA.md`,
  `DESIGN.md`, or a rule under `.agents/rules/`. Name the decision, not just the file, so the
  comment still reads if the document is reorganized: `never matrix() — see ADR-0024` over
  `see ADR-0024`.

- **Justifies a change to a reviewer.** "Changed this because the old version was slow." That is a
  commit message.
- **Records a changelog or an author.** "Added 2026-04, LH", "was `sent` before". `git log` and
  `git blame` answer both, always accurately.
- **Is a divider or a banner.** `// ===== HELPERS =====`, `// --- state ---`. Needing to signpost
  regions means the file should be split, or the declaration order in `code-style.md` should be
  followed instead. Column-group comments in large `database/schema/` tables are the one sanctioned
  exception.
- **Is a joke, an initial, or a personal note.** The next reader is a stranger, often a different
  model, with none of the context that made it land.
- **Is commented-out code.** Delete it; version control is the history. This has no exceptions.
- **Is a `TODO`/`FIXME` marker.** Incomplete work does not ship to `main` (see `AGENTS.md`); file it
  instead.
- **Exists to fill a file.** Never write a comment because a file has none, because a neighbouring
  file has several, or because a change would otherwise look small. A file with nothing non-obvious
  to say correctly has no comments.

## Keeping comments true

A comment and the code it describes change together, in the same edit, always. A change that
invalidates a comment must update or delete it before it lands — leaving it is not a smaller change,
it is a wrong one.

A stale comment is worse than no comment. Nothing in this repository validates comment text: not the
compiler, not the linter, not a test. A reader who finds one comment lying learns to skim all of
them, which costs every accurate comment its value too. When in doubt about a comment you did not
write, verify it against the code and delete it if it no longer holds.

## No JSDoc

This repository uses plain `//` line comments everywhere. Do not write `/** ... */` doc blocks and
do not write `@param`, `@returns`, `@type`, or other tags.

The reason is specific to this codebase, not a style preference. JSDoc/TSDoc earns its keep at a
_published_ API boundary — a library consumed by callers who cannot read the implementation, or a
generated documentation site. Remit has neither: it is a single self-hosted application, every
consumer of every function is in this repo, there is no docs generator, and the JSDoc tag vocabulary
is dominated by type annotations that TypeScript strict mode and Zod schemas already state
authoritatively. A `@param clientId The client id` is exactly the "restates the type" anti-pattern
above, wearing a syntax that makes it look official. If Remit ever publishes a package under
`packages/`, revisit this for that boundary only.

Multi-line explanations use stacked `//` lines, wrapped at the printer width.

## Placement and form

- A comment about a whole module sits at the top of the file, below the imports.
- A comment about an export sits immediately above it.
- A comment about one line or expression sits immediately above that line, inside the function.
- Prose, sentence case, full sentences. Reference other files by their path or function name
  (`services/constraints.ts`'s `applyFrameResize`), so the contract is followable.
- Column-group section comments in large `database/schema/` tables are the one sanctioned
  label-style comment (see `database.md`).
- An `eslint-disable` or tool-suppression directive carries a one-line reason stating why the code
  cannot change instead. A suppression with no reason is not acceptable.

## Components and JSX

`.tsx` files earn materially fewer comments than `.ts` files, because the "why" that a comment
exists to carry mostly lives elsewhere: the domain rules are in `services/`, the validation is in
`schemas.ts`, and the markup states its own structure. Comment a component only for:

- **A deliberate accessibility deviation** — why an element carries a role or an `aria-*` value that
  its markup would not imply, or why a keyboard affordance differs from the primitive's default.
- **A render-cost decision** — why a value is or is not memoized, why a row is `memo`'d, why a
  `useWatch` names the fields it does (see `components.md`).
- **A third-party quirk or workaround** — a Radix, dnd-kit, or react-hook-form behavior the code
  works around, where removing the workaround would silently break something.
- **A deliberate escape from the design system** — why raw markup is used where a `components/ui`
  primitive exists (already required by `components.md`).

Layout, markup structure, class names, conditional rendering, and prop wiring get none. `// Header`
above a `<header>` is the narrating anti-pattern in JSX clothing.

## Calibration checklist

Apply this to each comment, whether writing one or reviewing one. Any "yes" in the first three means
the comment does not ship.

1. Does the code already say this through its name, its type, or its structure?
2. Would a better name or an extracted function remove the need entirely?
3. Is it true only of today's implementation rather than of the contract?
4. Is it still true of the code beside it, right now?
5. Does it name a category from "A comment must earn its place" — invariant, cross-file contract,
   counter-intuitive decision, complex logic, trust boundary?

Deleting a comment that fails this is a success, including one written minutes earlier.

## Examples

All from `features/templates`, the reference feature for this standard.

A cross-file contract plus an invariant, on a type:

```ts
// The normalized runtime view of the persisted block tree: one entry per block with absolute
// page-space geometry and parentage, so hit-testing, selection, and gesture math never re-walk the
// tree. Commits convert back through toTree/updateRects, so the persisted tree shape never changes.
export type BlockIndexEntry = {
  /* ... */
}
```

A counter-intuitive decision, on one expression:

```ts
// A group never carries its own rotation (groupBounds.ts's normalizeGroups always re-derives its
// box from its children's union); every other type defaults to 0.
rotation: block.type === "group" ? 0 : (block.rotation ?? 0),
```

Complex logic a reader would otherwise re-derive — a grammar:

```ts
// Recursive-descent parser over the token list:
//   sum    := term (("+" | "-") term)*
//   term   := factor (("*" | "/") factor)*
//   factor := ["+" | "-"] number
// Returns null for any malformed sequence rather than throwing.
function parseTokens(tokens: Token[]): number | null {
```

A safety boundary, in an operational script:

```ts
// Never delete the archive this run just uploaded, even when retention policy would keep nothing
// (e.g. every tier set to 0). Discarding a freshly written backup while reporting success would be
// silent data loss.
```
