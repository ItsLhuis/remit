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

## Anti-patterns

Do not write a comment that:

- **Narrates the next line.** `// Set the status to paid` above `status: "paid"`.
- **Restates a name or a type.** The signature already says it; TypeScript strict mode enforces it.
- **References a plan, stage, phase, milestone, or prompt.** "Stage 11 rows", "added in phase 3".
  Comments are timeless; that belongs in the plan file.
- **Justifies a change to a reviewer.** "Changed this because the old version was slow." That is a
  commit message.
- **Is commented-out code.** Delete it; version control is the history. This has no exceptions.
- **Is a `TODO`/`FIXME` marker.** Incomplete work does not ship to `main` (see `AGENTS.md`); file it
  instead.

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
