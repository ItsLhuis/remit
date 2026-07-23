# ADR-0024: Template editor — free collision-aware page-clamped canvas

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

Templates are block-based documents and emails. `templates.blocks` stores a typed `Block[]` in a
jsonb column, and one pure `block → HTML/text` renderer turns that array into the live editor
preview and the ADR-0022 headless-browser PDF from a single code path.

The compositions users actually need — a logo beside an address block, a stamp over a table, a
sidebar of terms next to the line items — cannot be expressed by a document flow of rows, columns,
and slots: every such model forces full-width blocks and slot-limited placement. The editor
therefore has to be a genuinely free canvas.

A free canvas has one failure mode that matters: a block placed outside the printable page produces
a broken PDF that the user only discovers after sending. Overlap, by contrast, is a feature — it is
how a stamp sits on a table. So the canvas is free in every dimension except one hard geometric
rule.

## Decision

Blocks are absolutely positioned rectangles inside the page's content box, arranged by direct
manipulation, with exactly one hard geometric invariant — a block never leaves the content box —
enforced live by pure geometry the editor cannot bypass and re-validated server-side on save.
Overlap is legal and layered.

### Block model

A block is `{ id, type, content, layout, rotation?, name?, hidden, locked, constraints?, style? }`
over six types: `text | image | table | shape | frame | group`. There is no heading type — a
formatted `text` block is the heading.

`layout` is an absolute rectangle `{ x, y, width, height }` in whole page pixels inside the page's
content box (page minus margins, origin at the top-left inside the margins). Snapping to
`GRID_SIZE = 8` is the editor's default, not a persistence rule: holding Alt during a drag places a
block off-grid at whole-pixel precision, and that position persists. Coordinates are bounded
symmetrically (`±CANVAS_MAX_HEIGHT`) in the block schema rather than floored at 0, because a
container child's local position may legitimately go negative when it is dragged partly outside its
frame or group; the top-level floor at 0 is enforced separately at save time by `validateLayout`,
which needs the template type and margins the per-block schema cannot see. Width and height carry no
grid-multiple constraint — proportional set scaling cannot preserve both member proportions and
grid-aligned sizes — while a table column's width does keep one, since columns are never scaled
through the set primitive.

Documents compose at A4 print width (794px @96dpi, at least one 1123px page tall); emails at an
email-safe 600px. The page height grows with the lowest visible block through one pure formula
(`getPageHeight`) shared by the canvas, the preview, and the renderer, which is what makes the
preview pixel-identical to the canvas. A `text` block is resizable on both axes: the user authors
width and height, and the editor raises the stored height to a content floor (`contentMinHeight` —
the smallest whole-cell height containing the rendered text at its current width) so content never
clips, but never shrinks it below the authored height. That one stored height feeds canvas, preview,
and PDF identically, so parity holds by construction.

`hidden` and `locked` are Layers-panel flags: hidden blocks persist but are skipped by the renderer
in every format; locked blocks cannot be dragged or resized on the canvas and are still selectable
from the Layers tree. `style` is an optional shared presentation sub-object (per-side padding,
background, border, radius, font family key, size, weight, text color, alignment, line height)
emitted exclusively through one style→CSS mapper whose output the `document` sanitize profile
whitelists property-by-property.

Content per type is `text` `{ html }` (author HTML, reduced to the `authored` sanitize profile at
save); `image` `{ source: "upload" | "businessLogo", uploadId, alt }` — upload-only, never a URL,
with the business logo resolving `settings.businessLogoUploadId` through the assets map under a
reserved key; `table` `{ source: "manual" | "lineItems", columns, rows }`; `shape`
`{ variant: "rectangle" | "ellipse" | "line" }`; `frame` `{ clip, children }`; `group`
`{ children }`.

- **`table`** covers line items and any other tabular content. Manual mode is an author-controlled
  grid — add/remove rows and columns, per-column header and optional width, per-cell plain text that
  may hold scalar merge tokens. Line-items mode binds every column to a `lineItem.*` field (an enum
  binding, never token text); body rows populate from the document's collection at render time, with
  representative sample rows in the editor preview. A line-items table is legal only on template
  types that carry the collection (invoice, proposal, credit note, and their emails), validated at
  save.
- **`shape`** is a vector leaf drawn as one fill div. The `variant` is the whole choice; appearance
  comes from the shared `style` sub-object. An ellipse renders via `border-radius: 50%` (chosen over
  `clip-path` to keep the sanitizer surface minimal); a line is a thin bar.
- **`frame`** is the composition container: children are absolutely positioned, each carrying its
  own rectangle relative to the frame origin, so a frame is a free mini-canvas rather than a flex
  track. `clip` renders `overflow: hidden` so children can be masked to the frame. Children are the
  full block union — leaves, nested frames, or nested groups — capped at `FRAME_MAX_CHILDREN = 8`
  and bounded to `FRAME_MAX_DEPTH = 2` container levels by an explicit depth walk in the schema that
  counts a group exactly like a frame, so unbounded recursion can never reach the write path. A
  block dragged onto a frame becomes its child; the same depth walk and self/descendant guard apply
  when the dragged block is itself a container.
- **`group`** is a purely logical container: no `clip`, no `style`, and no rendered box of its own
  (`renderTemplate` positions a group's children directly, with no wrapping element). Unlike every
  other type, a group's `layout` is never authored: `normalizeGroups` re-derives it on every
  geometry commit as the tight bounding union of its children. A group is created only by grouping
  an existing selection (`groupSelection`) or by converting a wrap-in-frame gesture's target
  container (`wrapInFrame`); the insert menu never offers it, since it has no independently authored
  content. `ungroup` dissolves a group, splicing its children back into whatever held it, converted
  into that level's coordinate space; a group left with zero children is dropped rather than
  persisted empty.

### Rotation

`rotation` is an optional sibling of `layout`, never a `layout` field: degrees in `[0, 360)`,
clockwise in the page's y-down space, quantized to a tenth of a degree at commit, about the rect's
own center. The stored geometry is rect + rotation and nothing else — never a matrix. Absent is the
canonical spelling of "not rotated": an exact 0 is stripped on write, absent stays absent through
`normalizeBlocks`, readers apply `?? 0`, and the stored-read schema rejects out-of-range values.

A `group` never carries the field — its schema shape omits it and `buildIndex` forces 0. Rotating a
selected group rotates each child about the shared center (the child's own rotation accumulates the
delta and its center orbits), and the group's derived layout re-derives as the union of its
children's rotated AABBs. A frame rotates as one unit: the field lives on the frame and its children
ride along unrotated in local space.

The rotate gesture (rotate zones outside the selection's corner handles, Shift snapping to 15°
steps, a live degree badge) and the panel's rotation field both commit through the same pure
`rotateMath` services the per-frame preview runs, so the preview is the commit by construction. A
multi-selection rotates rigidly around its shared center; no rotate affordance renders for a
container's implicitly carried children. Hit-testing, marquee capture, selection handles, cursors,
and the bounds clamp (by rotated AABB) are all rotation-aware.

The renderer emits exactly `transform: rotate(<n>deg)` for a nonzero rotation — CSS's default center
transform-origin matches the stored convention — and the sanitizer's `document` profile whitelists
exactly that form and nothing else, so `matrix(...)` never reaches the renderer or the sanitizer. A
rotation-free document renders byte-identically to one produced before the field existed, pinned by
a renderer test.

### Geometry and enforced invariants

The model is layered: sibling array order is z-order (a block later in the array paints on top) and
a container's children paint above the container itself, so overlap is deliberate and addressable.
Exactly one hard geometric invariant remains — a block never leaves the page's content box —
enforced by pure geometry in `features/templates/services/`:

- **Move — clamp only** (`resolveMovedBlocks`): the moving set's union rectangle is clamped into the
  content box so members keep their exact relative offsets and stop together; a member inside a
  frame is bounded by that frame instead, and a member nested only in groups stays page-bounded,
  since a group is a derived union free to grow in every direction. Neighbours never move — the
  dragged block lands where it is dropped, above or beneath others per z-order.
- **Resize — hard clamp** (`resolveResize`): growth stops at the content bounds along each resizing
  axis, never allow-then-adjust, and each limit hit is reported so the canvas draws a guide line at
  it. Neighbour edges do not clamp a resize; the content-box edge is the only limit.
- **Z-order** is reordered explicitly through `bringForward` / `sendBackward` / `bringToFront` /
  `sendToBack`, which are pure array moves scoped to the block's own siblings, reachable from the
  context menu and the keyboard.
- **Save — server-side validation** (`validateLayout`): rejects any out-of-bounds block set (hidden
  blocks included, bounded by rotated AABB) and any line-items table on a type without the
  collection. Overlap is not a rejection reason. It runs in `updateTemplate` after the strict Zod
  parse, and nothing persists on failure. Only top-level blocks are checked, since a container
  child's position is legitimately relative to its container. A top-level block below 0 is rejected,
  not floored: every interactive path already clamps before it commits, so this is a backstop
  against malformed data, and a validator that silently floor-mutated a save payload would hide
  exactly the bug class it exists to catch.

Blocks spawn at per-type natural minimum sizes at the first free position below the lowest existing
block. Margin changes reflow by re-clamping every block into the new content box.

### Groups, constraints, and set resize

A group and an ad hoc multi-selection resize through one shared primitive: `resolveHandleResize`
resolves the eight handles' modifier semantics (Shift locks aspect, Alt anchors the center) into a
next reference rectangle, and `scaleBlockSet` maps every member's rectangle proportionally from the
base reference to the next one. Single-block resize is the same primitive with a one-member set
whose rect equals the reference, so it is not a special case, and `clampSetScaleFactors` floors the
scale so no member drops below the minimum size — the set stops together instead of letting one
member distort the arrangement.

A set's members are its full descendant subtree (`collectResizeMemberIds`), so nested frames and
groups scale as a unit with their contents. The one exception is a sole frame target, whose members
are only its own box: a frame has an authored size its direct children opt out of scaling with, via
per-axis `constraints` (`{ horizontal, vertical }`, one of `start | end | center | stretch | scale`,
absent meaning `start`/`start` — pin top-left). When a frame's own box resizes, `applyFrameResize`
reflows each direct child by its constraint instead of scaling it proportionally. That is the one
place resize is not a single code path, because a frame's authored box and a group's derived union
are different operations by design.

A set containing any rotated member is forced to scale uniformly, since a non-uniform stretch across
a rotated rectangle is a shear the rect+rotation geometry cannot represent. Resizing a single
rotated block by its own handles runs in the block's local axes and stays fully non-uniform. The
panel's width/height fields are a second entry point into the same primitive (`resizeBlocks`), not
an independent way to author a group's or a selection's size.

### Canvas engine

On-canvas move, resize, rotate, marquee, and pan run on a bespoke pointer-event engine —
`useCanvasEngine` over the `features/templates/engine/` modules: `gestures` classifies a press,
`pressState` holds intent, threshold, and pointer capture, `canvasPoint` converts screen↔content
coordinates through the current zoom, `frameTick` batches per-frame math and DOM writes into one
`requestAnimationFrame` callback, `dropCommit` resolves reparent and marquee commits, and
`announcer` / `LiveRegion` carry throttled `aria-live` announcements. `@dnd-kit/react` is retained
only for the Layers tree, where its sortable and droppable model still fits, and never touches the
canvas.

Every gesture is classified once at `pointerdown` — after a hit-test in content space — and tracked
through `setPointerCapture`, so a drag that leaves the page or the window keeps tracking and always
terminates. Live gesture state lives in an ephemeral interaction store (`useEditorInteraction`):
ref-backed, never undo-tracked, consumed through a subscription, with block nodes registering their
DOM elements so the engine writes in-flight transforms imperatively. The document store commits
exactly once, at `pointerup`, as one undo entry, and a `useLayoutEffect` clears the in-flight
transforms on the same commit render that paints the new rectangles, so no frame ever paints the
pre-gesture position.

`CanvasBlock` is `memo`-wrapped over referentially stable per-block handlers, so a pointer frame
re-renders no non-participating block and never recomputes any block's sanitized HTML — measured at
zero non-participating block-body renders per gesture frame across move, resize, rotate, marquee,
and group/multi-selection resize on a 32-block page. Every commit funnels through the pure
resolvers, so an out-of-bounds arrangement is impossible to commit.

Selection follows canvas conventions: a click selects the top-level ancestor under the cursor, a
double-click descends exactly one level (and enters in-place text editing on a text leaf),
Ctrl/Cmd-click deep-selects the topmost hit, Shift-click toggles membership, and a drag from empty
page draws a marquee (Ctrl/Cmd catches nested children, Shift toggles against the current
selection). Frames are drop targets: the pure `reparent` service owns page↔frame coordinate
conversion and the self/descendant and depth guards, and a non-frame drop falls back to a plain
move.

Alt bypasses grid snapping mid-drag, Shift axis-locks a move, and alignment guides appear when the
moving rectangle's edges meet a sibling's. Keyboard equivalence is complete: arrows nudge one grid
cell, Shift+arrows nudge ten whole pixels, Mod+arrows resize, Delete removes, Escape cancels an
in-flight gesture and otherwise clears the selection, and grouping, ungrouping, and wrap-in-frame
move focus to the resulting block so keyboard flow never strands on `document.body`. Every cancel
trigger — Escape, `pointercancel`, and window blur — funnels through one `cancelGesture` that
restores pre-gesture state and cursor.

Zoom is continuous and clamped to `[0.25, 2]`. The toolbar steps through discrete levels and
Ctrl/Cmd+wheel zooms at the pointer: a non-passive `wheel` listener stashes the pointer/scroll
anchor and a `useLayoutEffect` keyed to the zoom that actually took effect resolves the matching
scroll offset before the browser paints a frame at the wrong position. A wheel tick that clamps to a
no-op zoom would leave its anchor stale, so a one-frame identity check drops it before an unrelated
later zoom could consume it. The point-under-pointer invariant holds while the scaled page is at
least as wide as its scroll container; below that the browser pins `scrollLeft` to 0 and the
centering wrapper re-centers the page, so the pointed-at point drifts — an accepted limitation,
since there is no scroll room left to preserve.

### Editor surface

The editor is a full-viewport three-pane surface at `/templates/[templateId]`, in its own `(editor)`
route group so it renders without the dashboard sidebar and header and only its own panels scroll.

- **State** lives in one client hook (`useTemplateEditor`): `{ blocks, pageSettings }` document
  state with undo/redo (per-tag coalescing, so typing or arrow-nudging one block is one undo step),
  selection, zoom, assets, and dirtiness, plus the normalized `blockIndex` (`buildIndex` / `toTree`)
  that gives hit-testing and gesture math absolute page-space geometry without re-walking the tree.
- **Left panel** is the Layers tree only. Its root `Page` node selects page-level settings (margins,
  default font, base size, email subject); block layers nest beneath it top-of-stack first (array
  z-order reversed) with children indented one level per depth. Hovering a row highlights its bounds
  on the canvas without selecting it; dragging a row reorders it among its siblings or reparents it
  onto a frame.
- **Canvas** (`EditorCanvas`) renders the page at its computed size with every block absolutely
  positioned, and each block's inner HTML is the renderer's own output (`renderBlockContent`), never
  a hand-drawn approximation.
- **Floating toolbar** carries the select/pan tools, the zoom controls, and the insert menu — a
  dropdown listing the real block set (text, image, table, frame, and the three shape variants),
  each entry inserting that exact block.
- **Right panel** (`PropertyPanel`) is a sticky identity header over scrollable sections: an
  editable rectangle and rotation (through the same resolvers as the gestures), the per-type content
  editor, and style sections driven by a capability registry (`BLOCK_PROPERTY_GROUPS`). A
  multi-selection shows the fields its members share and an explicit mixed state where they
  disagree. Numeric fields accept small arithmetic expressions (`+10`, `240/2`, `10*3-8`; a leading
  `+`/`-` is relative to the current value) through a pure recursive-descent parser — never `eval`
  or `Function` — reverting invalid input.
- **Context menu** (`CanvasContextMenu`) opens for whatever block the right-click resolved under the
  cursor (keeping a multi-selection when the hit is already a member, else selecting the sole hit,
  else falling back to the page menu) and carries the full action set: duplicate, copy / paste /
  paste-here / copy-style / paste-style, group / ungroup / wrap-in-frame, z-order over the block's
  own sibling scope, hide / lock, rename, select-layer-under-cursor (a submenu of every hit at the
  point, for picking one out of an overlapping stack), and delete. Every row is capability-gated,
  undoable as one step, and keyboard-operable. The clipboard buffers are module-scoped in the hook
  layer rather than React state; paste re-ids the copied subtree and clamps it in bounds, duplicate
  is tree-aware (a nested source clones into its own parent), and copy-style/paste-style move only
  the `style` sub-object.
- **In-place text editing** (`CanvasTextEditor`) turns a text leaf into an editable surface at its
  exact position, size, and rotation. A double-click enters it with the caret at the clicked point;
  Enter on a selected leaf enters it with the caret at the end (Enter on a container descends
  instead, Shift+Enter ascends). Gesture arming is suspended for the edited block, the commit passes
  through the same `authored` sanitize boundary as every other write, and a caret-anchored `{{`
  autocomplete offers the per-type merge-variable whitelist.
- **Preview** renders the same `renderTemplate` output in a sandboxed iframe sized exactly to the
  page (same width, same computed height, zero body margin) at the editor's current zoom — no
  scrollbars, pixel-identical to the canvas. Zoom survives the canvas → preview → canvas toggle.

### Merge variables

The per-type identifier whitelist is derived from real database columns (client, business, payment,
invoice, proposal, contract, and credit-note groups); an identifier with no backing column does not
exist. The render contract is `TemplateRenderData = { values, lineItems? }`: scalars resolve through
the whitelist → dictionary lookup → HTML-escape path, never evaluation, and `lineItems` feeds
collection-bound tables. Values arrive pre-formatted server-side (money and dates at the boundary;
`payment.iban` decrypted only by the render-data builder). The picker shows human-readable labels
only, on the substitutable surfaces: text HTML, table headers, and manual table cells. Saves reject
unknown tokens.

### Render and sanitize pipeline

One pure emission path serves the canvas block previews, the full preview, and the PDF job: a
relatively positioned page at its computed height; every visible block absolutely positioned at its
rectangle offset by the margins; a shape as a single fill div (ellipse via `border-radius: 50%`); a
frame as a `position: relative` fill holding its absolutely positioned children, with
`overflow: hidden` when `clip` is set; a table as a real `<table>` with hairline collapsed borders.
Emails use the same absolute page at 600px — parity is mandatory for every type, and
email-client-safe transforms belong to the sending pipeline.

The security model is one `sanitizeHtml` service with an escape → substitute → sanitize order:
author HTML is reduced to the `authored` profile at save (frame and group children included), and
the assembled document passes through the `document` profile, whose style whitelist admits exactly
the renderer's emission set value-by-value (absolute position, left/top, `overflow: hidden`,
border-radius including `50%`, the bounded `rotate(<n>deg)` form, table declarations, the three font
stacks). Images are upload-only with a save-time existence check, and every write is audit-logged.

### Read-path migration

Reads normalize every stored generation through `normalizeBlocks` into the absolute shape, clamped
in bounds, losing no user-authored string:

- Absolute rows (layout carries `x`/`y`): quantize and clamp.
- Constrained-flow rows (`(row, column)`): rows stack vertically at a running y; side-by-side rows
  keep their horizontal arrangement (fixed widths honored, null widths sharing the content width
  equally); null heights take the type's natural default; a legacy `slot` folds to ordering.
- Legacy freeform rows (`frame {x, y, width, height}`): near-direct mapping.
- Original list rows (neither): vertical stack in array order.
- `heading` → `text`, with the string preserved HTML-escaped and the level approximated as
  font-size/weight style beneath any authored style.
- Structured domain types (`business_info`, `totals`, `signature`, ...) map onto `text` where they
  carried a user string and drop where they were toggle-only.
- `box` → `frame`: the flex children lay out to concrete absolute rectangles along the box's prior
  direction and gap at convert time, preserving each child's content and style; `clip` defaults
  false.
- `divider` → `shape { variant: "line" }`, a hairline bar preserved via a `#e2e8f0` fill.
- `spacer` → dropped: size-only, no authored content, since free positioning replaces whitespace.

The tolerant `storedBlockSchema` keeps every legacy shape for reading; the strict write-path schema
accepts only the current `text | image | table | shape | frame | group` union. Every prior
generation opens losslessly and re-saves in the current shape. No database migration is required —
the read path is tolerant and the block model is a content-schema concern.

## Consequences

### Positive

- Off-page placement is the one enforced geometric invariant, prevented live by pure geometry the
  editor cannot bypass and re-validated server-side on save, where nothing persists on failure.
- Canvas, preview, and PDF share one emission path and one page-size formula, so what the user
  arranges is exactly what renders.
- The sanitizer whitelist is exactly the emission set, so widening it requires naming the emitter.
- Geometry, migration, reparent, clipboard, expression parsing, and rendering are pure services
  (ADR-0007) with millisecond unit tests; the editor components stay thin orchestration over them.
- Participating blocks move without any React re-render, and no non-participating block re-renders
  during a gesture, so a dense page stays fluid.

### Negative

- Overlap being legal means the model cannot prevent a user from hiding one block behind another;
  z-order and the Layers tree are the only recourse.
- Storing rect + rotation instead of a matrix rules out shear, so scaling a set containing a rotated
  member is forced to be uniform.
- The bespoke pointer engine is code the repository owns and must maintain, including pointer
  capture, cancellation, and rAF batching that a drag library would otherwise provide.
- Zoom-at-pointer cannot preserve the pointed-at point once the scaled page is narrower than its
  scroll container.

## Alternatives considered

### Constrained `(row, column)` document flow

Made overlap unrepresentable, but forced full-width blocks, slot-limited placement, and row
machinery that fought real compositions. Enforced bounds over a free canvas give the same safety
with the interaction model the product needs.

### Enforced no-overlap with downward displacement

Overlapped neighbours would be pushed down so two blocks could never intersect. Rejected because
overlap is a first-class layering tool in this product, and displacement moves blocks the user did
not touch. Reject-and-snap-back was rejected for the same reason: a block lands where it is dropped.

### Flex `box` container with `divider` and `spacer` primitives

A container laying children out in a flex track, plus size-only primitives for rules and whitespace.
Rejected because a flex track contradicts the free-canvas model and cannot accept a drop-to-reparent
at a meaningful position; the `frame` of absolutely positioned children replaces it, a line shape
replaces `divider`, and free positioning replaces `spacer`.

### `@dnd-kit/react` on the canvas

Even its managed API cannot express the full gesture set inside one coherent pointer state machine:
rotate zones adjacent to resize handles, marquee capture, a shared group/multi-selection set-resize
primitive, zoom-at-pointer, and a single cancellation path across Escape, `pointercancel`, and
window blur. It is retained for the Layers tree, where sortable reordering is exactly what it
models.

### Full affine transform with matrix geometry

Supporting shear would let a rotated member scale non-uniformly, but a matrix has to be threaded
through hit-testing, gesture math, rendering, the sanitizer whitelist, and the PDF path. Rejected in
favor of rect + rotation and a uniform-only rule for rotated sets, which keeps every block a plain
rectangle end to end.

### Unbounded frame nesting

Rejected. Nesting is bounded to two container levels by an explicit depth walk in the write schema,
which keeps the write path statically safe; no database migration is needed, since nesting is a
content-schema concern and the read path stays tolerant.

### Email-specific stacked rendering

Rejected. Preview parity is mandatory for every template type, so emails share the absolute page and
any client-safe transform belongs to the sending pipeline.

### Structured domain block types

Header, totals, and line-item presets as first-class types. Rejected: composition belongs to the
user via primitives, the frame container, and the merge-variable whitelist, not to a hardcoded block
union that has to grow with every document layout someone wants.
