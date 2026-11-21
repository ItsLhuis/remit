import { type Block } from "../schemas"

import { type BlockIndex, enclosingFrameRect, updateRects } from "./blockIndex"
import { type ContentBounds, type Rect } from "./canvasLayout"
import {
  clampRotatedRectPositionToBounds,
  floorRotatedRectAtOrigin,
  rotatedAabb,
  shiftSpanIntoRange,
  translateRect,
  unionRects,
  type Point
} from "./geometry"

// The move counterpart to resizeMath.ts. The union of the page-bounded members clamps first, so the
// set stops together and keeps its exact relative offsets, matching the drag preview. A frame child
// floors at its frame's origin instead and is never page-bounded; a member nested only in groups is
// page-bounded, since a group is a derived union free to grow in every direction. The delta arrives
// already snapped or intentionally off-grid, so nothing re-quantizes here. Null for a no-op move,
// which would otherwise push an empty undo entry and clear a redo stack the user may be holding.
export function resolveMovedBlocks(
  index: BlockIndex,
  bounds: ContentBounds,
  ids: readonly string[],
  delta: Point
): Block[] | null {
  let dx = Math.round(delta.x)
  let dy = Math.round(delta.y)

  // Bounded by the footprint a member actually paints, so both the union clamp and the per-member
  // belts operate on AABBs; at rotation 0 that is the rect itself.
  const pageBoundRects = ids.flatMap((id) => {
    const entry = index.get(id)

    return entry && !entry.block.locked && enclosingFrameRect(index, id) === null
      ? [rotatedAabb(entry.pageRect, entry.rotation)]
      : []
  })
  const union = unionRects(pageBoundRects)

  if (union) {
    const moved = translateRect(union, { x: dx, y: dy })

    dx += shiftSpanIntoRange(moved.x, moved.x + moved.width, bounds.width)
    dy += shiftSpanIntoRange(moved.y, moved.y + moved.height, bounds.height)
  }

  const edits = new Map<string, Rect>()

  for (const id of ids) {
    const entry = index.get(id)

    if (!entry || entry.block.locked) continue

    const target = translateRect(entry.pageRect, { x: dx, y: dy })
    const frameRect = enclosingFrameRect(index, id)

    if (!frameRect) {
      edits.set(id, clampRotatedRectPositionToBounds(target, entry.rotation, bounds))

      continue
    }

    edits.set(
      id,
      entry.rotation === 0
        ? { ...target, x: Math.max(target.x, frameRect.x), y: Math.max(target.y, frameRect.y) }
        : floorRotatedRectAtOrigin(target, entry.rotation, frameRect)
    )
  }

  const changed = [...edits].some(([id, rect]) => {
    const current = index.get(id)?.pageRect

    return rect.x !== current?.x || rect.y !== current?.y
  })

  if (!changed) return null

  return updateRects(index, edits)
}
