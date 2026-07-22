import { type Block, type BlockLayout } from "../schemas"

import { type Rect } from "./canvasLayout"
import { type Point } from "./geometry"

// The normalized runtime view of the persisted block tree: one entry per block
// with absolute page-space geometry and parentage, so hit-testing, selection, and gesture math
// never re-walk the tree. Commits convert back through toTree/updateRects, so the persisted tree
// shape never changes.

export type BlockIndexEntry = {
  block: Block
  parentId: string | null
  childIds: readonly string[]
  pageRect: Rect
  rotation: number
  depth: number
  siblingIndex: number
}

export type BlockIndex = ReadonlyMap<string, BlockIndexEntry>

export function buildIndex(blocks: readonly Block[]): BlockIndex {
  const entries = new Map<string, BlockIndexEntry>()

  visit(entries, blocks, { parentId: null, origin: { x: 0, y: 0 }, depth: 0 })

  return entries
}

// Inverse of buildIndex: rebuilds the persisted tree from the entries. Container blocks re-derive
// their children arrays from childIds so replaced child blocks surface; untouched leaves keep
// their identity.
export function toTree(index: BlockIndex): Block[] {
  return [...index.values()]
    .filter((entry) => entry.parentId === null)
    .toSorted((a, b) => a.siblingIndex - b.siblingIndex)
    .map((entry) => rebuildBlock(index, entry))
}

// Applies page-space rectangle edits and returns the tree with them applied. A nested edit is
// converted to parent-local coordinates against the parent's (possibly also edited) page rect,
// so a frame and its children may move in one commit without their offsets drifting.
export function updateRects(index: BlockIndex, edits: ReadonlyMap<string, Rect>): Block[] {
  return [...index.values()]
    .filter((entry) => entry.parentId === null)
    .toSorted((a, b) => a.siblingIndex - b.siblingIndex)
    .map((entry) => rebuildWithEdits(index, entry, edits, { x: 0, y: 0 }))
}

export function topLevelAncestorOf(index: BlockIndex, id: string): string | null {
  const chain = ancestorChainOf(index, id)
  const top = chain[chain.length - 1]

  return top ?? null
}

// The keyboard descend target one level into id: a container's topmost child (childIds is z-order,
// last = top of stack), or null when id is not a container or has no children (already the
// deepest).
export function descendInto(index: BlockIndex, id: string): string | null {
  const entry = index.get(id)

  if (entry?.block.type !== "frame" && entry?.block.type !== "group") return null

  const childIds = entry.childIds

  return childIds[childIds.length - 1] ?? null
}

// The member id set a resize operates on: a sole frame target resizes only its own authored box
// (its children apply constraints separately - services/constraints.ts's applyFrameResize); every
// other target set (a leaf, a group, or a multi-selection) flattens each target's full descendant
// subtree into the set, so containers scale as one unit with their contents through the shared
// scale primitive. Shared by the engine's live preview (gestures.ts) and the document-store
// commit (useTemplateEditor.ts) so both entry points resolve the same set.
export function collectResizeMemberIds(index: BlockIndex, targets: readonly string[]): string[] {
  const soleId = targets.length === 1 ? targets[0] : undefined

  if (soleId !== undefined && index.get(soleId)?.block.type === "frame") return [soleId]

  const ids = new Set<string>()

  for (const id of targets) {
    ids.add(id)
    collectDescendantIds(index, id, ids)
  }

  return [...ids]
}

function collectDescendantIds(index: BlockIndex, id: string, into: Set<string>): void {
  const entry = index.get(id)

  if (!entry) return

  for (const childId of entry.childIds) {
    into.add(childId)
    collectDescendantIds(index, childId, into)
  }
}

// The page rect of the block's nearest enclosing frame, or null when no frame encloses it. A frame
// is an authored box that pins its children non-negative; a group is a derived bounding union that
// must be free to grow in every direction, so it is transparent here. A block with no enclosing
// frame - top level, or nested only in groups - is therefore bounded by the page, exactly like a
// top-level block, and one inside a frame is bounded by that frame instead and never by the page.
export function enclosingFrameRect(index: BlockIndex, id: string): Rect | null {
  const [, ...ancestors] = ancestorChainOf(index, id)

  for (const ancestorId of ancestors) {
    const entry = index.get(ancestorId)

    if (entry?.block.type === "frame") return entry.pageRect
  }

  return null
}

// The block's ancestry from itself up to its top-level ancestor: [id, parent, ..., topLevel].
// Unknown ids yield an empty chain.
export function ancestorChainOf(index: BlockIndex, id: string): string[] {
  const chain: string[] = []

  let current = index.get(id)

  while (current) {
    chain.push(current.block.id)
    current = current.parentId === null ? undefined : index.get(current.parentId)
  }

  return chain
}

type VisitContext = {
  parentId: string | null
  origin: Point
  depth: number
}

function visit(
  entries: Map<string, BlockIndexEntry>,
  blocks: readonly Block[],
  context: VisitContext
): void {
  blocks.forEach((block, siblingIndex) => {
    const pageRect: Rect = {
      ...block.layout,
      x: context.origin.x + block.layout.x,
      y: context.origin.y + block.layout.y
    }
    const children = block.type === "frame" || block.type === "group" ? block.content.children : []

    entries.set(block.id, {
      block,
      parentId: context.parentId,
      childIds: children.map((child) => child.id),
      pageRect,
      // A group never carries its own rotation (groupBounds.ts's normalizeGroups always
      // re-derives its box from its children's union); every other type defaults to 0.
      rotation: block.type === "group" ? 0 : (block.rotation ?? 0),
      depth: context.depth,
      siblingIndex
    })

    if (children.length > 0) {
      visit(entries, children, {
        parentId: block.id,
        origin: { x: pageRect.x, y: pageRect.y },
        depth: context.depth + 1
      })
    }
  })
}

function rebuildBlock(index: BlockIndex, entry: BlockIndexEntry): Block {
  const { block } = entry

  if (block.type !== "frame" && block.type !== "group") return block

  const children = entry.childIds
    .map((id) => index.get(id))
    .filter((child): child is BlockIndexEntry => child !== undefined)
    .map((child) => rebuildBlock(index, child))

  if (
    children.length === block.content.children.length &&
    children.every((child, position) => child === block.content.children[position])
  ) {
    return block
  }

  return { ...block, content: { ...block.content, children } } as Block
}

function rebuildWithEdits(
  index: BlockIndex,
  entry: BlockIndexEntry,
  edits: ReadonlyMap<string, Rect>,
  parentOrigin: Point
): Block {
  const { block } = entry
  const edit = edits.get(block.id)
  // An unedited block keeps its local layout, so it travels with an edited parent; an edited
  // block converts its page-space rect against the parent's already-updated origin.
  const layout: BlockLayout = edit
    ? {
        x: edit.x - parentOrigin.x,
        y: edit.y - parentOrigin.y,
        width: edit.width,
        height: edit.height
      }
    : block.layout
  const layoutChanged = !layoutsEqual(layout, block.layout)
  const origin: Point = { x: parentOrigin.x + layout.x, y: parentOrigin.y + layout.y }

  if (block.type !== "frame" && block.type !== "group") {
    return layoutChanged ? { ...block, layout } : block
  }

  const children = entry.childIds
    .map((id) => index.get(id))
    .filter((child): child is BlockIndexEntry => child !== undefined)
    .map((child) => rebuildWithEdits(index, child, edits, origin))

  const childrenChanged = children.some(
    (child, position) => child !== block.content.children[position]
  )

  if (!layoutChanged && !childrenChanged) return block

  return {
    ...block,
    layout,
    content: { ...block.content, children }
  } as Block
}

function layoutsEqual(a: BlockLayout, b: BlockLayout): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
