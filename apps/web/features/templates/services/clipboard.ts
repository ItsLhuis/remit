import { GRID_SIZE, type Block, type BlockStyle } from "../schemas"

import { reassignIds } from "./blocks"
import { findBlock, stripStyle } from "./blockTree"
import { clampRectToBounds, quantizeToGrid, type ContentBounds } from "./canvasLayout"
import { unionRects, type Point } from "./geometry"

// The clipboard's pure logic only. The buffer itself lives in the hook layer, which calls these
// with whatever it currently holds, keeping this file free of state.

// Null for an empty selection, so callers never store an empty clipboard buffer.
export function serializeSelection(
  blocks: readonly Block[],
  selectedIds: readonly string[]
): Block[] | null {
  const found = selectedIds
    .map((id) => findBlock(blocks, id)?.block)
    .filter((block): block is Block => block !== undefined)

  return found.length > 0 ? found : null
}

// Reuses duplicateBlock's reassignIds, so a paste and a duplicate share the same id-reassignment.
// An anchored "paste here" moves the set's bounding box top-left to the anchor, preserving relative
// offsets; a plain paste offsets one grid cell from the source.
export function materializePastedBlocks(
  payload: readonly Block[],
  bounds: ContentBounds,
  anchor?: Point
): Block[] {
  if (payload.length === 0) return []

  const delta = anchor ? pasteDelta(payload, anchor) : { x: GRID_SIZE, y: GRID_SIZE }

  return payload.map((block) => {
    const clone = reassignIds(structuredClone(block))

    return {
      ...clone,
      layout: clampRectToBounds(
        { ...clone.layout, x: clone.layout.x + delta.x, y: clone.layout.y + delta.y },
        bounds
      )
    }
  })
}

// A group carries no style of its own, matching stripStyle and BLOCK_PROPERTY_GROUPS.group = [].
export function extractStyle(block: Block): BlockStyle | undefined {
  return block.type === "group" ? undefined : block.style
}

// Replaces the whole style sub-object; geometry and content are never touched.
export function applyStyleToBlock(block: Block, style: BlockStyle | undefined): Block {
  if (block.type === "group") return block

  return style === undefined ? stripStyle(block) : { ...block, style }
}

function pasteDelta(payload: readonly Block[], anchor: Point): Point {
  const union = unionRects(payload.map((block) => block.layout))

  if (!union) return { x: 0, y: 0 }

  return { x: quantizeToGrid(anchor.x - union.x), y: quantizeToGrid(anchor.y - union.y) }
}
