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

// The move counterpart to resizeMath.ts: resolves a page-space delta over a set of blocks into the
// next block tree. The delta first clamps so the page-bounded members' union rect stays inside the
// content box - the set stops together and members keep their exact relative offsets, matching the
// drag preview's union clamp; the surviving per-member clamp is then a no-op belt for a single
// block. A member inside a frame is bounded by that frame instead, flooring at its origin and never
// by the page; a member nested only in groups is page-bounded like a top-level block, since a group
// is a derived union that must be free to grow in every direction. The delta arrives already snapped
// (or intentionally off-grid), so no re-quantization happens here. Returns null when the move is a
// no-op: a fully clamped move would otherwise push a meaningless undo entry and clear the redo
// stack the user may be holding.
export function resolveMovedBlocks(
  index: BlockIndex,
  bounds: ContentBounds,
  ids: readonly string[],
  delta: Point
): Block[] | null {
  let dx = Math.round(delta.x)
  let dy = Math.round(delta.y)

  // A rotated member is bounded by its rotated AABB — the footprint it actually paints — so both
  // the union clamp and the per-member belts below operate on visual footprints; at rotation 0 the
  // AABB is the rect itself and this reproduces the axis-aligned math exactly.
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
