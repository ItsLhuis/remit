import { type BlockIndex } from "./blockIndex"
import { type Rect } from "./canvasLayout"
import { normalizeDegrees, rotatedAabb, unionRects, type Point } from "./geometry"
import { type HandleDirection } from "./resizeMath"

// Selection-level geometry for the pointer engine's overlay: the shared bounding rect of a
// selection, the alignment guides shown while it moves, and the resize handle rig (position per
// direction, cursor per direction) drawn around it.

export type GuideLine = {
  key: string
  orientation: "vertical" | "horizontal"
  at: number
  emphasis: "reached" | "near"
}

// How close (page px) a neighbour edge must be before its guide line appears during a move.
const NEIGHBOUR_GUIDE_THRESHOLD = 24

// Clockwise from top-left; LiveOverlay renders handles in this order.
export const ALL_HANDLE_DIRECTIONS: readonly HandleDirection[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w"
]

// The axis-aligned box enclosing every selected block's visual footprint: a rotated member
// contributes its rotated AABB so the selection frame always encloses what is painted. At rotation
// 0 each member contributes its pageRect unchanged.
export function selectionBounds(index: BlockIndex, ids: Iterable<string>): Rect | null {
  const rects = [...ids]
    .map((id) => index.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
    .map((entry) => rotatedAabb(entry.pageRect, entry.rotation))

  return unionRects(rects)
}

// Alignment guides while moving: any top-level neighbour's edge the moving rectangle approaches
// within the threshold renders as a line, so the user can align blocks by eye. Each neighbour
// contributes four candidate edges (its left/right against the moving rect's right/left, its
// top/bottom against the moving rect's bottom/top). Overlap is legal, so these are pure alignment
// aids, not limits. The returned `at` is offset by the page margins so the overlay can position
// lines in page coordinates directly.
export function moveGuides(input: {
  moving: Rect
  movingIds: ReadonlySet<string>
  index: BlockIndex
  margins: { top: number; left: number }
}): GuideLine[] {
  const { moving, movingIds, index, margins } = input

  return [...index.values()].flatMap((entry) => {
    if (entry.parentId !== null || movingIds.has(entry.block.id)) return []

    const rect = entry.pageRect

    const verticalOverlap = moving.y < rect.y + rect.height && rect.y < moving.y + moving.height
    const horizontalOverlap = moving.x < rect.x + rect.width && rect.x < moving.x + moving.width

    const candidates = [
      {
        key: `${entry.block.id}-right`,
        orientation: "vertical" as const,
        edge: rect.x + rect.width,
        approach: moving.x,
        eligible: verticalOverlap,
        offset: margins.left
      },
      {
        key: `${entry.block.id}-left`,
        orientation: "vertical" as const,
        edge: rect.x,
        approach: moving.x + moving.width,
        eligible: verticalOverlap,
        offset: margins.left
      },
      {
        key: `${entry.block.id}-bottom`,
        orientation: "horizontal" as const,
        edge: rect.y + rect.height,
        approach: moving.y,
        eligible: horizontalOverlap,
        offset: margins.top
      },
      {
        key: `${entry.block.id}-top`,
        orientation: "horizontal" as const,
        edge: rect.y,
        approach: moving.y + moving.height,
        eligible: horizontalOverlap,
        offset: margins.top
      }
    ]

    return candidates.flatMap<GuideLine>((candidate) => {
      const isWithinThreshold =
        candidate.eligible &&
        Math.abs(candidate.edge - candidate.approach) <= NEIGHBOUR_GUIDE_THRESHOLD

      if (!isWithinThreshold) return []

      return [
        {
          key: candidate.key,
          orientation: candidate.orientation,
          at: candidate.offset + candidate.edge,
          emphasis: candidate.edge === candidate.approach ? "reached" : "near"
        }
      ]
    })
  })
}

// Base angle of each handle measured clockwise from north at rotation 0; cursorForHandle rotates
// this by the block's rotation before bucketing, so a rotated block's handles show the visually
// correct diagonal/straight cursor.
const HANDLE_BASE_ANGLES: Record<HandleDirection, number> = {
  n: 0,
  ne: 45,
  e: 90,
  se: 135,
  s: 180,
  sw: 225,
  w: 270,
  nw: 315
}

const HANDLE_CURSORS_BY_BUCKET = [
  "ns-resize",
  "nesw-resize",
  "ew-resize",
  "nwse-resize",
  "ns-resize",
  "nesw-resize",
  "ew-resize",
  "nwse-resize"
] as const

// The screen position of every handle around a selection's rect, rotated about its center (every
// caller passes rotation 0, where this is simply the rect's four corners and four edge midpoints).
export function handlePositions(rect: Rect, rotation: number): Record<HandleDirection, Point> {
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2

  const corners: Record<HandleDirection, Point> = {
    nw: { x: rect.x, y: rect.y },
    n: { x: centerX, y: rect.y },
    ne: { x: rect.x + rect.width, y: rect.y },
    e: { x: rect.x + rect.width, y: centerY },
    se: { x: rect.x + rect.width, y: rect.y + rect.height },
    s: { x: centerX, y: rect.y + rect.height },
    sw: { x: rect.x, y: rect.y + rect.height },
    w: { x: rect.x, y: centerY }
  }

  if (rotation === 0) return corners

  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return Object.fromEntries(
    ALL_HANDLE_DIRECTIONS.map((direction) => {
      const point = corners[direction]
      const dx = point.x - centerX
      const dy = point.y - centerY

      return [direction, { x: centerX + dx * cos - dy * sin, y: centerY + dx * sin + dy * cos }]
    })
  ) as Record<HandleDirection, Point>
}

// The CSS cursor for a handle: its base angle plus the block's rotation, bucketed into 8 45°
// sectors so a rotated block's handles show the visually correct straight/diagonal resize cursor.
export function cursorForHandle(direction: HandleDirection, rotation: number): string {
  const angle = normalizeDegrees(HANDLE_BASE_ANGLES[direction] + rotation)
  const bucket = Math.round(angle / 45) % HANDLE_CURSORS_BY_BUCKET.length

  return HANDLE_CURSORS_BY_BUCKET[bucket] ?? "nwse-resize"
}
