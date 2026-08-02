import { type Block } from "../schemas"

import { type Rect } from "./canvasLayout"
import { rotatedAabb, unionRects, type Point } from "./geometry"

// Bounds construction shared by the marquee and group derivation: a pair of arbitrary points into
// a normalized rectangle, whichever corner the gesture started from.

export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)

  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

// The union of the children's local rects is itself in that local space, not necessarily anchored
// at (0, 0). normalizeGroups folds that offset into the group's parent-space layout and subtracts
// it back out of every child, which keeps the box an exact union after every edit rather than only
// at creation. A rotated child contributes its AABB, so the box encloses what it actually paints.
export function deriveGroupLayout(children: readonly Block[]): Rect | null {
  return unionRects(children.map(enclosingChildRect))
}

export type ContainerRebase = { layout: Rect; children: Block[] }

// Shared by groupSelection and wrapInFrame so both derive identical geometry from an identical
// selection; only the container type the caller wraps the result in differs.
export function deriveContainerRebase(children: readonly Block[]): ContainerRebase | null {
  const union = deriveGroupLayout(children)

  if (!union) return null

  const rebased = children.map((child) => ({
    ...child,
    layout: { ...child.layout, x: child.layout.x - union.x, y: child.layout.y - union.y }
  }))

  return { layout: union, children: rebased }
}

// The single choke point every geometry commit runs through, recomputing bottom-up. A group whose
// children drop to zero is dropped entirely rather than left violating the schema's "at least one
// child" invariant. Reference-stable, so a tree with no group is a no-op.
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

// The raw rect at rotation 0, preserving normalizeGroups's reference-stable fast path; otherwise
// the AABB expanded to whole pixels so the derived group layout stays integer.
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

// Axis-aligned rotations produce ~1e-14 noise on exact integer corners, and flooring it would creep
// the derived box a pixel per pass and break the fixed point. 1e-3 clears it without touching
// genuine fractions.
function snapNoise(value: number): number {
  return Math.round(value * 1000) / 1000
}
