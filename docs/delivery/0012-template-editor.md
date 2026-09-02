# DR-0012: Template editor

- **Status:** Shipped
- **Date:** 2026-07-27
- **Verdict:** Complete
- **Decisions:** ADR-0024
- **Supersedes:** —
- **Reconstructed:** yes

## What

A block-based visual editor on a free, collision-aware, page-clamped canvas for invoice, proposal,
contract, credit-note and email templates, with merge variables resolved against real document data.

## Why

Every document Remit sends carries the freelancer's branding, and a product that hard-codes one
layout makes the document look like the tool rather than the business. The alternatives were a theme
picker, which is not enough, or raw HTML editing, which asks a freelancer to be a developer. The
editor is also the single largest surface in the product and the one where an unprincipled
implementation would have been most expensive to unwind, which is why it has its own ADR.

## Scope

Included: the canvas with free placement, collision awareness and page clamping; primitive blocks
including text, image, table and container groups; multi-select, grouping, reparenting, move,
resize, rotate and clipboard; zoom and pan; merge-variable autocomplete resolved from the document
shell; per-template page settings; and the templates list with preview.

Excluded: a general-purpose design tool. The canvas is clamped to a page because the output is a PDF
with physical dimensions, and an unclamped canvas would let a user build a template that cannot be
printed. Also excluded: CSS transforms for block geometry — the ADR records that geometry is
computed in page space rather than delegated to `matrix()`, so hit-testing and the persisted tree
agree.

## How

The runtime lives in `features/templates/engine/`, which is the only such folder in the repository.
It exists because the pointer runtime — the gesture machinery, the hooks that drive it, its
module-level stores and the overlays it owns — is one cohesive unit that splits across `services/`,
`hooks/` and `components/` without belonging to any of them. `.agents/rules/architecture.md` records
that another feature should not copy the pattern without an equally strong reason.

`blockIndex.ts` builds a normalised runtime view of the persisted tree: one entry per block with
absolute page-space geometry and parentage, so hit-testing, selection and gesture math never re-walk
the tree. Commits convert back through the tree helpers, so the persisted shape never changes.

The geometry is deliberately spread across small pure services — `moveMath`, `resizeMath`,
`rotateMath`, `constraints`, `groupBounds`, `selectionGeometry`, `hitTest` — because it is the part
a reader would otherwise have to re-derive, and because it is the part that has to be unit-testable
without a DOM.

Drag-and-drop moved to dnd-kit so the layer tree and the canvas share one interaction model and the
editor is keyboard operable.

## Evidence

- `features/templates/engine/`, `features/templates/services/` — 30 service modules
- `features/templates/services/blockIndex.ts`, `constraints.ts`, `moveMath.ts`, `resizeMath.ts`,
  `rotateMath.ts`, `groupBounds.ts`, `hitTest.ts`, `reparent.ts`, `mergeVariables.ts`,
  `sanitizeHtml.ts`
- `features/templates/components/TemplateEditorPage/`, `app/(editor)/templates/[templateId]/`
- `database/schema/templates.ts`
- `docs/architecture/adr/0024-template-editor-canvas.md`

## Verification

Twenty-five service test files cover the geometry, constraints, tree operations, merge-variable
resolution and HTML sanitisation. Eleven Playwright specs under `tests/e2e/` exercise the pointer
runtime end to end against a real browser: move, resize, rotate, multi-select, grouping,
reparenting, the context menu, frame continuity, wheel zoom, text editing under zoom and
merge-variable autocomplete. That is the heaviest E2E coverage in the repository, because a gesture
bug is invisible to a unit test.

Not covered: rendering fidelity of the produced PDF against the on-canvas layout. The renderer is
verified separately and the correspondence is checked by eye.

## Known gaps

Nothing recorded on the day.
