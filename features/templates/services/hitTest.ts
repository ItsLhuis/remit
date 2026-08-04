import {
  ancestorChainOf,
  topLevelAncestorOf,
  type BlockIndex,
  type BlockIndexEntry
} from "./blockIndex"
import { type Rect } from "./canvasLayout"
import { pointInRotatedRect, rectsIntersectRotated, type Point } from "./geometry"

// Ids under a canvas point, topmost first. Paint order is sibling array order and children paint
// above their container, so the walk visits siblings top-down and each container's children first.
// Hidden subtrees never hit; locked blocks are skipped unless the caller opts in, which reparent
// targeting does because a lock protects a frame's own geometry, not what may be dropped into it.

export type HitTestOptions = {
  includeLocked?: boolean
}

export function hitTestBlocks(
  index: BlockIndex,
  point: Point,
  options: HitTestOptions = {}
): string[] {
  return collectHits(index, entriesInPaintOrder(index, null), point, options)
}

export function deepestAt(index: BlockIndex, point: Point): string | null {
  return hitTestBlocks(index, point)[0] ?? null
}

export function topLevelAncestorAt(index: BlockIndex, point: Point): string | null {
  const deepest = deepestAt(index, point)

  return deepest === null ? null : topLevelAncestorOf(index, deepest)
}

export type MarqueeOptions = {
  // Ctrl/Cmd-marquee catches the deepest intersecting node per branch, not top-level blocks.
  nested: boolean
}

// Same locked/hidden rules as ordinary hit-testing. Nested mode keeps the deepest intersecting node
// per branch, so a container is reported only where none of its descendants also intersect.
export function blocksInMarquee(
  index: BlockIndex,
  marqueeRect: Rect,
  options: MarqueeOptions
): string[] {
  const candidates = [...index.values()].filter(
    (entry) =>
      !entry.block.locked &&
      !inHiddenSubtree(index, entry.block.id) &&
      rectsIntersectRotated(entry.pageRect, entry.rotation, marqueeRect, 0)
  )

  if (!options.nested) {
    return candidates.filter((entry) => entry.parentId === null).map((entry) => entry.block.id)
  }

  const ancestorsOfCandidates = new Set(
    candidates.flatMap((entry) => ancestorChainOf(index, entry.block.id).slice(1))
  )

  return candidates.flatMap((entry) =>
    ancestorsOfCandidates.has(entry.block.id) ? [] : [entry.block.id]
  )
}

// A visible child of a hidden container is not painted, so the marquee must not catch it.
function inHiddenSubtree(index: BlockIndex, id: string): boolean {
  return ancestorChainOf(index, id).some(
    (ancestorId) => index.get(ancestorId)?.block.hidden === true
  )
}

function entriesInPaintOrder(index: BlockIndex, parentId: string | null): BlockIndexEntry[] {
  return [...index.values()]
    .filter((entry) => entry.parentId === parentId)
    .toSorted((a, b) => a.siblingIndex - b.siblingIndex)
}

function collectHits(
  index: BlockIndex,
  entries: readonly BlockIndexEntry[],
  point: Point,
  options: HitTestOptions
): string[] {
  const hits: string[] = []

  for (const entry of entries.toReversed()) {
    if (entry.block.hidden) continue

    const inside = pointInRotatedRect(point, entry.pageRect, entry.rotation)

    if (entry.childIds.length > 0) {
      const clips = entry.block.type === "frame" && entry.block.content.clip

      if (inside || !clips) {
        hits.push(...collectHits(index, entriesInPaintOrder(index, entry.block.id), point, options))
      }
    }

    if (inside && (options.includeLocked === true || !entry.block.locked)) {
      hits.push(entry.block.id)
    }
  }

  return hits
}
