import { type PointerEvent as ReactPointerEvent } from "react"

import {
  ALL_HANDLE_DIRECTIONS,
  type HandleDirection,
  type Point,
  type Rect,
  type ResizeSetMember,
  type RotationMember
} from "../services"

import {
  GESTURE_ACTIVATION_DISTANCE,
  type ActiveGesture,
  type MoveUpdate,
  type ResizeUpdate,
  type RotateUpdate
} from "./gestures"

// The engine's press-state model plus the small pointer/press helpers that classify raw DOM
// events. A press arms at pointerdown and carries everything its gesture needs; useCanvasEngine
// owns the lifecycle and per-frame work.

// A dedicated rotate cursor (CSS has no native one): a small circular-arrow SVG, hotspot at its
// center, falling back to grab. Shared by the rotate zones and the in-gesture container cursor.
export const ROTATE_CURSOR = `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8'/%3E%3Cpath d='M21 3v5h-5'/%3E%3C/svg%3E") 8 8, grab`

export type PointerSample = {
  clientX: number
  clientY: number
  shiftKey: boolean
  altKey: boolean
}

export type PressState =
  | { kind: "pan"; pointerId: number; startClient: Point; startScroll: Point }
  | { kind: "toggle"; pointerId: number }
  | {
      kind: "empty"
      pointerId: number
      startClient: Point
      origin: Point
      moved: boolean
      nested: boolean
      additive: boolean
    }
  | {
      kind: "move"
      pointerId: number
      startClient: Point
      origin: Point
      ids: string[]
      activated: boolean
      gesture: ActiveGesture | null
      baseRects: Map<string, Rect>
      parentRects: Map<string, Rect>
      rotations: Map<string, number>
      clamp: boolean
      lastUpdate: MoveUpdate | null
    }
  | {
      kind: "resize"
      pointerId: number
      startClient: Point
      origin: Point
      targets: string[]
      direction: HandleDirection
      baseReference: Rect
      baseRotation: number
      baseRects: Map<string, Rect>
      members: ResizeSetMember[]
      uniformOnly: boolean
      clamp: boolean
      parentRect: Rect | null
      activated: boolean
      gesture: ActiveGesture | null
      lastUpdate: ResizeUpdate | null
    }
  | {
      kind: "rotate"
      pointerId: number
      startClient: Point
      origin: Point
      targets: string[]
      members: RotationMember[]
      baseRects: Map<string, Rect>
      center: Point
      activated: boolean
      gesture: ActiveGesture | null
      lastUpdate: RotateUpdate | null
    }

export function pastThreshold(start: Point, event: { clientX: number; clientY: number }): boolean {
  return Math.hypot(event.clientX - start.x, event.clientY - start.y) >= GESTURE_ACTIVATION_DISTANCE
}

// happy-dom lacks pointer capture; real browsers route every subsequent pointer event to the
// scroll container until release, so drags never drop when the pointer leaves it.
export function capturePointer(event: ReactPointerEvent<HTMLDivElement>): void {
  if (typeof event.currentTarget.setPointerCapture === "function") {
    event.currentTarget.setPointerCapture(event.pointerId)
  }
}

// The direction of the resize handle under a pointerdown target, or null when the press did not
// land on a handle. LiveOverlay stamps each handle with data-resize-handle="<direction>".
export function handleDirectionAt(target: EventTarget | null): HandleDirection | null {
  if (!(target instanceof Element)) return null

  const handle = target.closest("[data-resize-handle]")

  if (!(handle instanceof HTMLElement)) return null

  const direction = handle.dataset.resizeHandle

  return ALL_HANDLE_DIRECTIONS.find((candidate) => candidate === direction) ?? null
}

// Whether a pointerdown landed on one of LiveOverlay's rotate zones (stamped
// data-rotate-zone), checked before block hit-testing exactly like the resize handles.
export function isRotateZoneTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-rotate-zone]") !== null
}

// A pointerdown landing inside the active inline text-editing surface is native text interaction
// (placing the caret, selecting a word) and must never arm a gesture — checked before any other
// press classification. contentEditable is inherited, so every descendant of the editable element
// matches too. The merge-variable autocomplete popover is part of the same surface but portaled to
// the document body for CSS-transform reasons, so it carries no inherited isContentEditable and is
// matched by its own marker instead — without this, React's portal-aware event bubbling still
// delivers its pointerdown here (portals bubble through the React tree, not the DOM tree), which
// would call setPointerCapture on the canvas surface and hijack every subsequent pointer event away
// from the popover mid-click.
export function isTextEditSurfaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return target.isContentEditable || target.closest("[data-text-edit-surface]") !== null
}

export function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

// The one transform the engine ever writes: the frame's translation composed with the member's
// rotation, in that order (translate in page axes, then rotate about the element's center) —
// exactly what the committed render produces (CanvasBlock's rotate + the block's rect).
export function composeTransform(dx: number, dy: number, rotation: number): string {
  const translate = dx === 0 && dy === 0 ? "" : `translate(${dx}px, ${dy}px)`
  const rotate = rotation === 0 ? "" : `rotate(${rotation}deg)`

  return [translate, rotate].filter(Boolean).join(" ")
}

// Clearing an in-flight transform must put back the block's committed rotation (CanvasBlock
// renders it as the wrapper's inline transform, which every engine write replaced), never a bare
// "": the caller passes a lookup into the current block index.
export function clearNodeTransforms(
  getNode: (id: string) => HTMLElement | null,
  ids: readonly string[],
  rotationOf: (id: string) => number
): void {
  for (const id of ids) {
    const node = getNode(id)

    if (node) node.style.transform = composeTransform(0, 0, rotationOf(id))
  }
}

// A resize writes width/height inline as well as the transform, so cancelling one must put the
// pre-gesture sizes back (a commit instead lets React's commit render own them).
export function restoreNodeRects(
  getNode: (id: string) => HTMLElement | null,
  baseRects: ReadonlyMap<string, Rect>,
  rotationOf: (id: string) => number
): void {
  for (const [id, base] of baseRects) {
    const node = getNode(id)

    if (!node) continue

    node.style.transform = composeTransform(0, 0, rotationOf(id))
    node.style.width = `${base.width}px`
    node.style.height = `${base.height}px`
  }
}
