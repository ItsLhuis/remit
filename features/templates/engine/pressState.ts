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

// The press-state model plus the helpers that classify raw DOM events. A press arms at pointerdown
// carrying everything its gesture needs; useCanvasEngine owns the lifecycle and per-frame work.

// CSS has no native rotate cursor, so this is an inline SVG with its hotspot at the center.
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

// happy-dom lacks pointer capture. Real browsers route every later pointer event to the scroll
// container until release, so drags never drop when the pointer leaves it.
export function capturePointer(event: ReactPointerEvent<HTMLDivElement>): void {
  if (typeof event.currentTarget.setPointerCapture === "function") {
    event.currentTarget.setPointerCapture(event.pointerId)
  }
}

// LiveOverlay stamps each handle with data-resize-handle="<direction>".
export function handleDirectionAt(target: EventTarget | null): HandleDirection | null {
  if (!(target instanceof Element)) return null

  const handle = target.closest("[data-resize-handle]")

  if (!(handle instanceof HTMLElement)) return null

  const direction = handle.dataset.resizeHandle

  return ALL_HANDLE_DIRECTIONS.find((candidate) => candidate === direction) ?? null
}

// Checked before block hit-testing, exactly like the resize handles.
export function isRotateZoneTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-rotate-zone]") !== null
}

// A pointerdown inside the inline text surface is native text interaction and must never arm a
// gesture. contentEditable is inherited, so descendants match too - but the autocomplete popover is
// portaled to the body and carries no inherited flag, so it needs its own marker. Without it React's
// portal-aware bubbling still delivers the pointerdown here, and the resulting setPointerCapture
// would hijack every subsequent pointer event away from the popover mid-click.
export function isTextEditSurfaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return target.isContentEditable || target.closest("[data-text-edit-surface]") !== null
}

export function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

// The one transform the engine ever writes: translate in page axes, then rotate about the element's
// center - exactly what the committed render produces.
export function composeTransform(dx: number, dy: number, rotation: number): string {
  const translate = dx === 0 && dy === 0 ? "" : `translate(${dx}px, ${dy}px)`
  const rotate = rotation === 0 ? "" : `rotate(${rotation}deg)`

  return [translate, rotate].filter(Boolean).join(" ")
}

// Never clears to a bare "": CanvasBlock renders the committed rotation as that same inline
// transform, so the caller passes a lookup into the current block index to restore it.
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

// A resize writes width/height inline too, so a cancel must restore the pre-gesture sizes; a commit
// instead lets React's commit render own them.
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
