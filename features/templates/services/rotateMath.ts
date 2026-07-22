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

// The rotate counterpart to moveMath.ts/resizeMath.ts: collects the member set a rotation operates
// on, maps each member through a shared-center (gesture) or own-center (panel) rotation, and
// resolves the next block tree. A group never rotates itself — a group target expands into its
// children, each carrying the rotation individually, and normalizeGroups re-derives the group's box
// from their rotated union on commit. The engine's live preview and the document-store commit both
// run rotateSetBy, so the preview is the commit by construction.

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

// Rotation values commit quantized to a tenth of a degree: fine enough for any authoring intent,
// coarse enough that a stored value can never serialize into scientific notation the renderer's
// exact-form transform emission (and the sanitizer whitelist built from it) would not survive.
export function quantizeDegrees(value: number): number {
  return Math.round(value * 10) / 10
}

// The member set a rotation operates on: locked members are skipped (matching the resize member
// filter), a group expands into its children (a group never carries rotation), and every other
// target — a frame included — rotates as one unit with its children riding along. The shared
// center is the selection bounds' center, which for a single block is its own center.
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

// Rotates every member by the same delta about the shared center: each member's own rotation
// accumulates the delta and its center orbits the shared one, so the arrangement turns rigidly.
// Page-bound members' rotated AABBs then clamp back inside the bounds as one rigid translation, and
// a frame child's footprint floors at its frame's origin — the same bound semantics a move applies.
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

// Sets every member to the same absolute rotation about its own center: rects stay in place (bar
// the bounds clamp), only the stored rotation changes — the property panel's write semantics.
export function rotateSetTo(
  members: readonly RotationMember[],
  degrees: number,
  bounds: ContentBounds
): Map<string, RotatedMember> {
  const rotation = foldRotation(degrees)

  const rotated = members.map((member) => ({ member, rect: member.rect, rotation }))

  return clampRotatedSet(rotated, bounds)
}

// Rotate-gesture commit: applies a shared-center delta to the targets' member set and returns the
// next block tree, or null when the rotation changes nothing (so no undo entry is pushed).
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

// Panel commit: sets the targets' member set to one absolute rotation about each member's own
// center. Null when every member already carries it.
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

// The shared bounds pass: page-bound members (no enclosing frame — a member nested only in groups
// is page-bound, like a move) clamp as one rigid translation of their rotated AABBs' union, then
// each frame child floors its own footprint at its frame's origin.
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

// Writes each member's next rotation onto its block in the rebuilt tree. A rotation of exactly 0
// strips the field — absent stays the canonical spelling of "not rotated" — and a group is never
// written to (it cannot carry the field).
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
