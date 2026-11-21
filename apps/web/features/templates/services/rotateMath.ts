import { type Block } from "../schemas"

import { enclosingFrameRect, updateRects, type BlockIndex } from "./blockIndex"
import { type ContentBounds, type Rect } from "./canvasLayout"
import {
  floorRotatedRectAtOrigin,
  normalizeDegrees,
  rotatedAabb,
  rotatePoint,
  shiftSpanIntoRange,
  translateRect,
  unionRects,
  type Point
} from "./geometry"
import { selectionBounds } from "./selectionGeometry"

// The rotate counterpart to moveMath.ts and resizeMath.ts. A group never rotates itself: a group
// target expands into its children, each carrying the rotation individually, and normalizeGroups
// re-derives the box from their rotated union. The live preview and the commit both run
// rotateSetBy, so the preview is the commit by construction.

export type RotationMember = {
  id: string
  rect: Rect
  rotation: number
  frameRect: Rect | null
}

export type RotationSet = {
  members: RotationMember[]
  center: Point
}

export type RotatedMember = {
  rect: Rect
  rotation: number
}

// A tenth of a degree is coarse enough that a stored value can never serialize into scientific
// notation, which the renderer's exact-form transform and the sanitizer whitelist would reject.
export function quantizeDegrees(value: number): number {
  return Math.round(value * 10) / 10
}

// A group expands into its children, while every other target - a frame included - rotates as one
// unit with its children riding along. Locked members are skipped, matching the resize filter.
export function collectRotationMembers(
  index: BlockIndex,
  targets: readonly string[]
): RotationSet | null {
  const union = selectionBounds(index, targets)

  if (!union) return null

  const members: RotationMember[] = []
  const seen = new Set<string>()

  const visit = (id: string) => {
    if (seen.has(id)) return

    seen.add(id)

    const entry = index.get(id)

    if (!entry || entry.block.locked) return

    if (entry.block.type === "group") {
      for (const childId of entry.childIds) visit(childId)

      return
    }

    members.push({
      id,
      rect: entry.pageRect,
      rotation: entry.rotation,
      frameRect: enclosingFrameRect(index, id)
    })
  }

  for (const id of targets) visit(id)

  if (members.length === 0) return null

  return { members, center: { x: union.x + union.width / 2, y: union.y + union.height / 2 } }
}

// Each member's rotation accumulates the delta and its center orbits the shared one, so the
// arrangement turns rigidly. The bounds pass afterwards applies the same semantics a move does.
export function rotateSetBy(
  members: readonly RotationMember[],
  center: Point,
  degrees: number,
  bounds: ContentBounds
): Map<string, RotatedMember> {
  const delta = quantizeDegrees(degrees)

  const rotated = members.map((member) => {
    const memberCenter = {
      x: member.rect.x + member.rect.width / 2,
      y: member.rect.y + member.rect.height / 2
    }
    const nextCenter = rotatePoint(memberCenter, center, delta)

    return {
      member,
      rect: {
        ...member.rect,
        x: Math.round(nextCenter.x - member.rect.width / 2),
        y: Math.round(nextCenter.y - member.rect.height / 2)
      },
      rotation: foldRotation(member.rotation + delta)
    }
  })

  return clampRotatedSet(rotated, bounds)
}

// The property panel's write semantics: rects stay in place bar the bounds clamp, and only the
// stored rotation changes.
export function rotateSetTo(
  members: readonly RotationMember[],
  degrees: number,
  bounds: ContentBounds
): Map<string, RotatedMember> {
  const rotation = foldRotation(degrees)

  const rotated = members.map((member) => ({ member, rect: member.rect, rotation }))

  return clampRotatedSet(rotated, bounds)
}

// Null when the rotation changes nothing, so no empty undo entry is pushed.
export function resolveRotatedBlocks(
  index: BlockIndex,
  bounds: ContentBounds,
  targets: readonly string[],
  degrees: number
): Block[] | null {
  const set = collectRotationMembers(index, targets)

  if (!set) return null

  return applyRotationSet(index, set.members, rotateSetBy(set.members, set.center, degrees, bounds))
}

// Null when every member already carries that rotation.
export function resolveBlocksRotationTo(
  index: BlockIndex,
  bounds: ContentBounds,
  targets: readonly string[],
  degrees: number
): Block[] | null {
  const set = collectRotationMembers(index, targets)

  if (!set) return null

  return applyRotationSet(index, set.members, rotateSetTo(set.members, degrees, bounds))
}

type PendingMember = {
  member: RotationMember
  rect: Rect
  rotation: number
}

// Page-bound members clamp as one rigid translation of their AABBs' union, then each frame child
// floors its own footprint at its frame's origin.
function clampRotatedSet(
  rotated: readonly PendingMember[],
  bounds: ContentBounds
): Map<string, RotatedMember> {
  const pageAabbs = rotated
    .filter((entry) => entry.member.frameRect === null)
    .map((entry) => rotatedAabb(entry.rect, entry.rotation))
  const union = unionRects(pageAabbs)

  const shift: Point = union
    ? {
        x: shiftSpanIntoRange(union.x, union.x + union.width, bounds.width),
        y: shiftSpanIntoRange(union.y, union.y + union.height, bounds.height)
      }
    : { x: 0, y: 0 }

  const result = new Map<string, RotatedMember>()

  for (const entry of rotated) {
    const shifted = shift.x === 0 && shift.y === 0 ? entry.rect : translateRect(entry.rect, shift)
    const rect = entry.member.frameRect
      ? floorRotatedRectAtOrigin(shifted, entry.rotation, entry.member.frameRect)
      : shifted

    result.set(entry.member.id, { rect, rotation: entry.rotation })
  }

  return result
}

function applyRotationSet(
  index: BlockIndex,
  members: readonly RotationMember[],
  next: ReadonlyMap<string, RotatedMember>
): Block[] | null {
  const edits = new Map<string, Rect>()
  const rotations = new Map<string, number>()

  let changed = false

  for (const member of members) {
    const value = next.get(member.id)

    if (!value) continue

    edits.set(member.id, value.rect)
    rotations.set(member.id, value.rotation)

    if (!rectsEqual(value.rect, member.rect) || value.rotation !== member.rotation) changed = true
  }

  if (!changed) return null

  return withRotations(updateRects(index, edits), rotations)
}

// A rotation of exactly 0 strips the field: absent stays the canonical spelling of "not rotated".
// A group is never written to, since it cannot carry the field.
function withRotations(blocks: readonly Block[], rotations: ReadonlyMap<string, number>): Block[] {
  return blocks.map((block) => {
    let next = block

    if (next.type === "frame" || next.type === "group") {
      const currentChildren = next.content.children
      const children = withRotations(currentChildren, rotations)

      if (children.some((child, position) => child !== currentChildren[position])) {
        next = { ...next, content: { ...next.content, children } } as Block
      }
    }

    const rotation = rotations.get(next.id)

    if (rotation === undefined || next.type === "group") return next
    if (rotation === (next.rotation ?? 0)) return next

    if (rotation === 0) {
      const stripped = { ...next }

      delete stripped.rotation

      return stripped
    }

    return { ...next, rotation }
  })
}

export function foldRotation(value: number): number {
  const rotation = quantizeDegrees(normalizeDegrees(value))

  return rotation >= 360 ? 0 : rotation
}

function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
