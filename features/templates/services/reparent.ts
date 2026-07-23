import { FRAME_MAX_DEPTH, type Block } from "../schemas"

import { containerNestingDepth } from "./blocks"
import { type ContentBounds, type Rect } from "./canvasLayout"
import { clampRectPositionToBounds } from "./geometry"

type Point = { x: number; y: number }

type Located = { block: Block; parentId: string | null; parentOrigin: Point }

export type ReparentResult = { blocks: Block[] }

// Positions are converted into the target's local space but never re-quantized: grid snapping (or
// its Alt bypass) is already applied upstream by the gesture math before the drop. An id absent
// from `droppedRects` keeps its committed absolute position. Returns null when the move is
// impossible, would place a frame child at a negative local coordinate, or is a global no-op.
export function reparentBlock(input: {
  blocks: readonly Block[]
  draggedIds: readonly string[]
  targetFrameId: string | null
  bounds: ContentBounds
  droppedRects?: ReadonlyMap<string, Rect>
}): ReparentResult | null {
  const { blocks, draggedIds, targetFrameId, bounds, droppedRects } = input

  if (draggedIds.length === 0) return null

  if (targetFrameId !== null && draggedIds.includes(targetFrameId)) return null

  const located = draggedIds.map((id) => locate(blocks, id))

  if (located.some((entry) => entry === null)) return null

  const draggedEntries = located as Located[]

  let targetOrigin: Point = { x: 0, y: 0 }

  if (targetFrameId !== null) {
    const target = locate(blocks, targetFrameId)

    if (target?.block.type !== "frame") return null

    if (draggedEntries.some((entry) => containsId(entry.block, targetFrameId))) return null

    targetOrigin = {
      x: target.parentOrigin.x + target.block.layout.x,
      y: target.parentOrigin.y + target.block.layout.y
    }
  }

  const anyMoves = draggedEntries.some((entry) => entry.parentId !== targetFrameId)

  if (!anyMoves) return null

  const localPositions = draggedIds.map((id, index) => {
    const dragged = draggedEntries[index]
    const droppedRect = droppedRects?.get(id)

    const absoluteX = droppedRect ? droppedRect.x : dragged.parentOrigin.x + dragged.block.layout.x
    const absoluteY = droppedRect ? droppedRect.y : dragged.parentOrigin.y + dragged.block.layout.y

    return { x: absoluteX - targetOrigin.x, y: absoluteY - targetOrigin.y }
  })

  // A frame child's local coordinate can't be negative (coordinateSchema is .min(0)), so a drop
  // that would require one is refused rather than floored, which would silently teleport the block.
  if (targetFrameId !== null && localPositions.some((point) => point.x < 0 || point.y < 0)) {
    return null
  }

  const relocated = draggedIds.map((id, index) => {
    const dragged = draggedEntries[index]
    const local = localPositions[index]

    const rect: Rect = { ...dragged.block.layout, x: local.x, y: local.y }
    const position = targetFrameId === null ? clampRectPositionToBounds(rect, bounds) : rect

    return { ...dragged.block, layout: { ...dragged.block.layout, x: position.x, y: position.y } }
  })

  const draggedIdSet = new Set(draggedIds)
  const candidate = insertAllInto(removeByIds(blocks, draggedIdSet), targetFrameId, relocated)

  if (
    candidate.some(
      (block) =>
        (block.type === "frame" || block.type === "group") &&
        containerNestingDepth(block) > FRAME_MAX_DEPTH
    )
  ) {
    return null
  }

  return { blocks: candidate }
}

// Finds a block anywhere in the tree, reporting its parent frame id and the page-space origin of
// that parent's content box (0,0 for a top-level block), so a nested block's absolute page position
// is parentOrigin + its own layout.
function locate(
  blocks: readonly Block[],
  id: string,
  parentOrigin: Point = { x: 0, y: 0 },
  parentId: string | null = null
): Located | null {
  for (const block of blocks) {
    if (block.id === id) return { block, parentId, parentOrigin }

    if (block.type === "frame" || block.type === "group") {
      const childOrigin = {
        x: parentOrigin.x + block.layout.x,
        y: parentOrigin.y + block.layout.y
      }

      const nested = locate(block.content.children, id, childOrigin, block.id)

      if (nested) return nested
    }
  }

  return null
}

function containsId(block: Block, id: string): boolean {
  if (block.id === id) return true

  if (block.type !== "frame" && block.type !== "group") return false

  return block.content.children.some((child) => containsId(child, id))
}

function removeByIds(blocks: readonly Block[], ids: ReadonlySet<string>): Block[] {
  return blocks.flatMap((block) => {
    if (ids.has(block.id)) return []

    if (block.type !== "frame" && block.type !== "group") return block

    return {
      ...block,
      content: { ...block.content, children: removeByIds(block.content.children, ids) }
    } as Block
  })
}

function insertAllInto(
  blocks: readonly Block[],
  targetFrameId: string | null,
  children: readonly Block[]
): Block[] {
  if (targetFrameId === null) return [...blocks, ...children]

  return blocks.map((block) => {
    if (block.type !== "frame" && block.type !== "group") return block

    if (block.id === targetFrameId) {
      return {
        ...block,
        content: { ...block.content, children: [...block.content.children, ...children] }
      } as Block
    }

    return {
      ...block,
      content: {
        ...block.content,
        children: insertAllInto(block.content.children, targetFrameId, children)
      }
    } as Block
  })
}
