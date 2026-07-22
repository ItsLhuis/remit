import { type Block } from "../schemas"

import { type Rect } from "./canvasLayout"
import { rotatedAabb, unionRects, type Point } from "./geometry"

// Bounds-construction math shared by the marquee and group derivation: turning a pair of arbitrary
// points into a normalized rectangle, regardless of which corner the gesture started from.

export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)

  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

// A group's children keep their own x/y relative to the group's origin exactly like frame children,
// so the tight bounding union of their local rects is itself expressed in that same local space -
// not necessarily anchored at (0, 0). normalizeGroups folds that union's
// own offset into the group's parent-space layout and subtracts it back out of every child, which
// is what keeps the group's box the exact bounding union after every edit, not only at creation.
// A rotated child contributes its rotated AABB, snapped outward to whole pixels, so the group's box
// always encloses what the child actually paints — never just its unrotated rect.
export function deriveGroupLayout(children: readonly Block[]): Rect | null {
  return unionRects(children.map(enclosingChildRect))
}

export type ContainerRebase = { layout: Rect; children: Block[] }

// Shared by group creation (groupSelection) and frame-wrap creation (wrapInFrame): both start from
// the same selected blocks, in the same parent-local coordinate space, and must derive the exact
// same union box and child offsets so the two entry points produce identical geometry - the only
// difference is which container type the caller wraps the result in.
export function deriveContainerRebase(children: readonly Block[]): ContainerRebase | null {
  const union = deriveGroupLayout(children)

  if (!union) return null

  const rebased = children.map((child) => ({
    ...child,
    layout: { ...child.layout, x: child.layout.x - union.x, y: child.layout.y - union.y }
  }))

  return { layout: union, children: rebased }
}

// Recomputes every group's layout, bottom-up, from its (already-recomputed) children - the single
// choke point every geometry commit runs through (useTemplateEditor's commit). Cascades: a group
// whose children drop to zero (the last member removed from it) is dropped entirely rather than
// left violating the schema's "at least one child" invariant. Reference-stable: a tree with no
// group anywhere, or one already in its normalized (zero local offset) steady state, returns the
// exact same array/block references it was given.
export function normalizeGroups(blocks: readonly Block[]): Block[] {
  let changed = false

  const next = blocks.flatMap((block) => {
    const normalized = normalizeContainer(block)

    if (normalized !== block) changed = true

    return normalized === null ? [] : [normalized]
  })

  return changed || next.length !== blocks.length ? next : (blocks as Block[])
}

function normalizeContainer(block: Block): Block | null {
  if (block.type !== "frame" && block.type !== "group") return block

  const children = normalizeGroups(block.content.children)

  if (block.type === "frame") {
    if (children === block.content.children) return block

    return { ...block, content: { ...block.content, children } } as Block
  }

  if (children.length === 0) return null

  const union = deriveGroupLayout(children)

  if (!union) return null

  const rebased =
    union.x === 0 && union.y === 0
      ? children
      : children.map((child) => ({
          ...child,
          layout: { ...child.layout, x: child.layout.x - union.x, y: child.layout.y - union.y }
        }))

  const layout: Rect = {
    x: block.layout.x + union.x,
    y: block.layout.y + union.y,
    width: union.width,
    height: union.height
  }

  if (rebased === children && rectEqual(layout, block.layout)) return block

  return { ...block, layout, content: { ...block.content, children: rebased } } as Block
}

function rectEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

// The child's visual footprint in its parent's local space: the raw rect at rotation 0 (unchanged,
// preserving normalizeGroups's reference-stable fast path), or the rotated AABB floored/ceiled to
// the enclosing whole-pixel box so the derived group layout stays integer.
function enclosingChildRect(child: Block): Rect {
  const rotation = child.type === "group" ? 0 : (child.rotation ?? 0)

  if (rotation === 0) return child.layout

  const aabb = rotatedAabb(child.layout, rotation)
  const x = Math.floor(snapNoise(aabb.x))
  const y = Math.floor(snapNoise(aabb.y))

  return {
    x,
    y,
    width: Math.ceil(snapNoise(aabb.x + aabb.width)) - x,
    height: Math.ceil(snapNoise(aabb.y + aabb.height)) - y
  }
}

// Axis-aligned rotations (90/180/270) produce ~1e-14 trigonometric noise on what are exact integer
// corners; flooring that noise would creep the derived box by a pixel per normalization pass and
// break the fixed point. Snapping to 1e-3 removes the noise without touching genuine fractions.
function snapNoise(value: number): number {
  return Math.round(value * 1000) / 1000
}
