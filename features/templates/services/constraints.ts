import { MIN_BLOCK_HEIGHT, MIN_BLOCK_WIDTH, type Block, type BlockConstraints } from "../schemas"

import {
  type BlockIndex,
  collectResizeMemberIds,
  enclosingFrameRect,
  updateRects
} from "./blockIndex"
import { findBlock, replaceById } from "./blockTree"
import {
  clampResizeRectToBounds,
  quantizeToGrid,
  type ContentBounds,
  type Rect,
  type Size
} from "./canvasLayout"
import { fitRotatedRectWithinBounds, floorRotatedRectAtOrigin } from "./geometry"
import { scaleBlockSet, type ResizeSetMember } from "./resizeMath"
import { selectionBounds } from "./selectionGeometry"

// Applies a frame's per-child layout constraints when the frame's own authored box resizes:
// unlike a group or multi-selection resize, which always proportionally scales
// every member through the shared set-scale primitive (services/resizeMath.ts), a frame has an
// authored box and each child opts into one behavior per axis independently. A child with no
// constraints defaults to "start"/"start" (pin top-left, today's resize behavior), matching a
// child block schema.ts describes as "absent === pin top-left".

const DEFAULT_CONSTRAINTS: BlockConstraints = { horizontal: "start", vertical: "start" }

type AxisResult = { start: number; size: number }

type AxisResizeInput = {
  constraint: BlockConstraints["horizontal"]
  start: number
  size: number
  oldExtent: number
  newExtent: number
  minSize: number
}

export function applyFrameResize(
  children: readonly Block[],
  oldSize: Size,
  newSize: Size
): Block[] {
  return children.map((child) => {
    const constraints = child.constraints ?? DEFAULT_CONSTRAINTS

    const horizontal = resizeAxis({
      constraint: constraints.horizontal,
      start: child.layout.x,
      size: child.layout.width,
      oldExtent: oldSize.width,
      newExtent: newSize.width,
      minSize: MIN_BLOCK_WIDTH
    })
    const vertical = resizeAxis({
      constraint: constraints.vertical,
      start: child.layout.y,
      size: child.layout.height,
      oldExtent: oldSize.height,
      newExtent: newSize.height,
      minSize: MIN_BLOCK_HEIGHT
    })

    return {
      ...child,
      layout: {
        x: Math.round(horizontal.start),
        y: Math.round(vertical.start),
        width: Math.round(horizontal.size),
        height: Math.round(vertical.size)
      }
    }
  })
}

// One axis of one child: start keeps the near-edge offset; end keeps the far-edge offset; center
// keeps the center's proportional position; stretch pins both edges (the size absorbs the frame's
// delta); scale keeps the child proportional to the frame on that axis (position and size both
// scale by the same factor).
function resizeAxis({
  constraint,
  start,
  size,
  oldExtent,
  newExtent,
  minSize
}: AxisResizeInput): AxisResult {
  const delta = newExtent - oldExtent

  switch (constraint) {
    case "start":
      return { start, size }
    case "end":
      return { start: start + delta, size }
    case "center": {
      const center = start + size / 2
      const nextCenter = (center / oldExtent) * newExtent

      return { start: nextCenter - size / 2, size }
    }
    case "stretch":
      return { start, size: Math.max(size + delta, minSize) }
    case "scale": {
      const factor = newExtent / oldExtent

      return { start: start * factor, size: Math.max(size * factor, minSize) }
    }
  }
}

// The shared resize commit primitive: the handle gesture and the panel's width/height fields both
// resolve a next reference rect and reduce it to a final block tree through this one path. targets
// is the raw target set (a single block, a group, or a multi-selection); the reference rect is its
// union, but the member set that actually scales is collectResizeMemberIds's expansion - a sole
// frame target scales only its own box (its children reflow via constraints below), every other
// target set (a leaf, a group, or a multi-selection) flattens each target's full descendant subtree
// into the members that scale together. A one-member set maps to nextReference exactly. Sizes
// quantize to the grid for a single member (position keeps whatever grid offset it had); a genuine
// multi-member set commits whole pixels so member proportions are preserved. A top-level set
// shrink-clamps into the content box (the anchored edge never moves); a frame child stays unclamped
// by the page but floors at its parent's content origin, matching moveBlocks. Returns null when the
// resize has no effect (no valid target, no member, or no edit).
export function resolveResizedBlocks(
  blockIndex: BlockIndex,
  bounds: ContentBounds,
  targets: readonly string[],
  nextReference: Rect
): Block[] | null {
  // A sole target's base is its own rect and rotation — the member maps 1:1 onto the reference
  // and a rotated block clamps by its rotated AABB; a multi-selection's base is the union at
  // rotation 0. This mirrors collectResizeSet so the gesture preview and this commit agree.
  const soleEntry =
    targets.length === 1 && targets[0] !== undefined ? blockIndex.get(targets[0]) : undefined
  const baseReference = soleEntry?.pageRect ?? selectionBounds(blockIndex, targets)
  const baseRotation = soleEntry?.rotation ?? 0

  if (!baseReference) return null

  const members: ResizeSetMember[] = []

  for (const id of collectResizeMemberIds(blockIndex, targets)) {
    const entry = blockIndex.get(id)

    if (entry && !entry.block.locked) {
      members.push({ id, rect: entry.pageRect, rotation: entry.rotation })
    }
  }

  if (members.length === 0) return null

  const sized =
    members.length === 1
      ? {
          ...nextReference,
          width: Math.max(quantizeToGrid(nextReference.width), MIN_BLOCK_WIDTH),
          height: Math.max(quantizeToGrid(nextReference.height), MIN_BLOCK_HEIGHT)
        }
      : nextReference

  const resolvedReference = resolveReferenceBounds({
    blockIndex,
    bounds,
    targets,
    sized,
    baseRotation
  })

  const scaled = scaleBlockSet(members, baseReference, resolvedReference)

  const edits = new Map<string, Rect>()

  for (const [id, value] of scaled) {
    edits.set(id, {
      x: Math.round(value.rect.x),
      y: Math.round(value.rect.y),
      width: Math.round(value.rect.width),
      height: Math.round(value.rect.height)
    })
  }

  if (edits.size === 0) return null

  return reflowResizedFrame(blockIndex, updateRects(blockIndex, edits), targets, edits)
}

// The reference rect's bound: a top-level set clamps into the page content box (by rotated AABB at
// nonzero rotation), a frame child floors at its parent's content origin — the same split the
// gesture preview applies, so preview and commit agree.
function resolveReferenceBounds(input: {
  blockIndex: BlockIndex
  bounds: ContentBounds
  targets: readonly string[]
  sized: Rect
  baseRotation: number
}): Rect {
  const { blockIndex, bounds, targets, sized, baseRotation } = input

  const clampToPage = targets.some((id) => blockIndex.get(id)?.parentId === null)

  if (clampToPage) {
    return baseRotation === 0
      ? clampResizeRectToBounds(sized, bounds).rect
      : fitRotatedRectWithinBounds(sized, baseRotation, bounds)
  }

  return baseRotation === 0
    ? floorAtParentOrigin(blockIndex, sized, targets[0])
    : floorRotatedAtParentOrigin(blockIndex, sized, baseRotation, targets[0])
}

// The frame/group distinction: a sole frame target resizes only its own authored box (handled
// above via scaleBlockSet's one-member set), and its direct children then reflow per their own
// constraints against the frame's old/new size - never proportionally scaled with the frame,
// unlike a group's or a multi-selection's members. A no-op for every other target set (which has
// no single authored frame box to reflow children against).
function reflowResizedFrame(
  blockIndex: BlockIndex,
  nextBlocks: Block[],
  targets: readonly string[],
  edits: ReadonlyMap<string, Rect>
): Block[] {
  const soleId = targets.length === 1 ? targets[0] : undefined

  if (soleId === undefined) return nextBlocks

  const soleEntry = blockIndex.get(soleId)

  if (soleEntry?.block.type !== "frame") return nextBlocks

  const nextRect = edits.get(soleId)
  const resizedFrame = findBlock(nextBlocks, soleId)?.block

  if (!nextRect || resizedFrame?.type !== "frame") return nextBlocks

  const reflowedChildren = applyFrameResize(
    resizedFrame.content.children,
    { width: soleEntry.block.layout.width, height: soleEntry.block.layout.height },
    { width: nextRect.width, height: nextRect.height }
  )

  return replaceById(nextBlocks, {
    ...resizedFrame,
    content: { ...resizedFrame.content, children: reflowedChildren }
  })
}

// A frame child's reference floors at its parent's page origin with no upper bound - the frame's
// own box does not clamp its children (clip only masks the overflow). Edge-preserving floor,
// mirroring clampResizeRectToBounds's left/top logic: shrinking the near edge into the parent
// origin shrinks the size by the same delta so the opposite (anchor) edge never moves, matching
// resolveResizeUpdate's per-frame preview.
// The rotated counterpart: a rotated child's footprint (its rotated AABB) floors at the frame's
// origin by translation — the local rect cannot shrink one raw edge and stay a rectangle in page
// space.
function floorRotatedAtParentOrigin(
  blockIndex: BlockIndex,
  rect: Rect,
  rotation: number,
  id: string | undefined
): Rect {
  const frameRect = id === undefined ? null : enclosingFrameRect(blockIndex, id)

  return floorRotatedRectAtOrigin(rect, rotation, frameRect ?? { x: 0, y: 0 })
}

function floorAtParentOrigin(blockIndex: BlockIndex, rect: Rect, id: string | undefined): Rect {
  const frameRect = id === undefined ? null : enclosingFrameRect(blockIndex, id)

  const flooredX = Math.max(rect.x, frameRect?.x ?? 0)
  const flooredY = Math.max(rect.y, frameRect?.y ?? 0)

  return {
    x: flooredX,
    y: flooredY,
    width: Math.max(rect.width - (flooredX - rect.x), MIN_BLOCK_WIDTH),
    height: Math.max(rect.height - (flooredY - rect.y), MIN_BLOCK_HEIGHT)
  }
}
