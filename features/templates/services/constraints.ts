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

// Unlike a group or multi-selection resize, which proportionally scales every member, a frame has
// an authored box and each child opts into one behavior per axis. A child with no constraints
// defaults to "start"/"start", matching schemas.ts's "absent means pin top-left".

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

// start keeps the near-edge offset, end the far-edge offset, center the proportional center;
// stretch pins both edges so the size absorbs the delta, scale moves position and size together.
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

// The commit counterpart of the gesture layer's resolveResizeUpdate, and it must reproduce that
// preview's result exactly: same member expansion, same one-member-only quantization, same
// shrink-clamp for a top-level set and origin floor for a frame child. Null when the resize has no
// effect, so no empty undo entry is pushed.
export function resolveResizedBlocks(
  blockIndex: BlockIndex,
  bounds: ContentBounds,
  targets: readonly string[],
  nextReference: Rect
): Block[] | null {
  // Mirrors collectResizeSet, so the gesture preview and this commit agree: a sole target's base
  // is its own rect and rotation, a multi-selection's is the union at rotation 0.
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

// The same split the gesture preview applies: a top-level set clamps into the page content box, a
// frame child only floors at its parent's origin.
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

// A frame's children reflow per their own constraints rather than scaling with it, which is the
// whole frame/group distinction. A no-op for every other target set.
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

// No upper bound: a frame's box does not clamp its children, clip only masks the overflow. The
// floor is edge-preserving so the anchor edge never moves, matching resolveResizeUpdate. A rotated
// child floors by translation instead - its local rect cannot shrink one raw edge and stay a
// rectangle in page space.
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
