import { type RefObject } from "react"

import { type EditorInteraction, type InteractionOverlay, type TemplateEditorState } from "../hooks"
import {
  blocksInMarquee,
  moveGuides,
  normalizeDegrees,
  rectFromPoints,
  unionRects,
  type Point,
  type Rect
} from "../services"

import { toContentPoint } from "./canvasPoint"
import {
  resizeLimitGuides,
  resolveMoveUpdate,
  resolveResizeUpdate,
  resolveRotateUpdate,
  type MoveUpdate,
  type ResizeUpdate,
  type RotateUpdate
} from "./gestures"
import { composeTransform, type PointerSample, type PressState } from "./pressState"

export type UseCanvasEngineOptions = {
  editor: TemplateEditorState
  interaction: EditorInteraction
  pageRef: RefObject<HTMLDivElement | null>
  scrollRef: RefObject<HTMLDivElement | null>
  panToolActive: boolean
  spaceHeld: boolean
  disabled: boolean
  isSnapBypassed: () => boolean
  onGestureStart: (ids: readonly string[]) => void
  onGestureEnd: (ids: readonly string[], position: Point) => void
  onGestureCancel: (ids: readonly string[]) => void
  onEnterTextEdit: (id: string) => void
  onMarqueeSelect: (ids: readonly string[]) => void
  onMoveProgress: (ids: readonly string[], position: Point) => void
  onResizeProgress: (ids: readonly string[], size: { width: number; height: number }) => void
  onRotateProgress: (ids: readonly string[], degrees: number) => void
  onMarqueeProgress: (count: number) => void
  onMarqueeCancel: () => void
}

// Per-frame pointermove work: turns the current press plus the latest pointer sample into this
// frame's geometry and writes it straight to the registered block nodes, at most once per rAF
// tick, zero document-store round trips. Every function here takes the already-dereferenced
// options and press state as plain arguments (never a React ref) so it can be called from
// useCanvasEngine's event-handler closures with no ref crossing the module boundary.
// useCanvasEngine owns the refs, classification, arming, and commit; this module owns only what
// happens between pointerdown and pointerup, once per frame.

export function contentPointAt(
  opts: UseCanvasEngineOptions,
  sample: { clientX: number; clientY: number }
): Point | null {
  const page = opts.pageRef.current

  if (!page) return null

  return toContentPoint(sample, page, opts.editor.zoom, opts.editor.pageSettings.margins)
}

// Every gesture-driven overlay update preserves the layers panel's hover highlight — a gesture
// in progress and a hovered row are independent bits of ephemeral UI state.
export function setGestureOverlay(
  opts: UseCanvasEngineOptions,
  patch: Omit<InteractionOverlay, "hoveredId" | "rotationBadge"> & { rotationBadge?: number | null }
): void {
  const interaction = opts.interaction

  interaction.setOverlay({
    rotationBadge: null,
    ...patch,
    hoveredId: interaction.getOverlay().hoveredId
  })
}

export function resolveUpdateAt(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "move" }>,
  sample: PointerSample
): MoveUpdate | null {
  const point = contentPointAt(opts, sample)

  if (!point) return null

  return resolveMoveUpdate({
    baseRects: press.baseRects,
    origin: press.origin,
    point,
    axisLocked: sample.shiftKey,
    snap: !opts.isSnapBypassed(),
    clamp: press.clamp,
    bounds: opts.editor.bounds,
    parentRects: press.parentRects,
    rotations: press.rotations
  })
}

export function resolveResizeUpdateAt(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "resize" }>,
  sample: PointerSample
): ResizeUpdate | null {
  const point = contentPointAt(opts, sample)

  if (!point) return null

  return resolveResizeUpdate({
    members: press.members,
    baseReference: press.baseReference,
    baseRotation: press.baseRotation,
    direction: press.direction,
    origin: press.origin,
    point,
    shiftKey: sample.shiftKey,
    altKey: sample.altKey,
    uniformOnly: press.uniformOnly,
    clamp: press.clamp,
    bounds: opts.editor.bounds,
    ...(press.parentRect ? { parentRect: press.parentRect } : {})
  })
}

export function runMoveFrame(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "move" }>,
  sample: PointerSample
): void {
  const update = resolveUpdateAt(opts, press, sample)

  if (!update) return

  press.lastUpdate = update

  for (const [id, rect] of update.rects) {
    const node = opts.interaction.getNode(id)
    const base = press.baseRects.get(id)

    if (!node || !base) continue

    node.style.transform = composeTransform(
      rect.x - base.x,
      rect.y - base.y,
      press.rotations.get(id) ?? 0
    )
  }

  const union = unionRects([...update.rects.values()])
  const { margins } = opts.editor.pageSettings
  const guides = union
    ? moveGuides({
        moving: union,
        movingIds: new Set(press.ids),
        index: opts.editor.blockIndex,
        margins: { top: margins.top, left: margins.left }
      })
    : []

  // liveRects stays null for a move: handles are hidden during it, so nothing overlay-visible
  // depends on the per-frame rects, and a fresh Map here would re-render LiveOverlay every
  // frame — breaking the zero-React-commits-per-frame invariant the move path guarantees.
  setGestureOverlay(opts, { gesture: press.gesture, guides, liveRects: null, marquee: null })

  const lead = press.ids[0] === undefined ? undefined : update.rects.get(press.ids[0])

  if (lead) opts.onMoveProgress(press.ids, { x: lead.x, y: lead.y })
}

// Per-frame marquee math: the live rect only, in the same content-space coordinates as every
// block's pageRect, so LiveOverlay can position it exactly like the hover/gesture chrome.
export function runMarqueeFrame(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "empty" }>,
  sample: PointerSample
): void {
  const point = contentPointAt(opts, sample)

  if (!point) return

  const rect = rectFromPoints(press.origin, point)

  setGestureOverlay(opts, { gesture: null, guides: [], liveRects: null, marquee: rect })

  const candidates = blocksInMarquee(opts.editor.blockIndex, rect, { nested: press.nested })

  opts.onMarqueeProgress(candidates.length)
}

// Per-member DOM writes for a live resize: position via transform against the base rect (the
// same channel a move uses) and size via inline width/height. Zero React commits per frame.
export function applyResizeRects(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "resize" }>,
  update: ResizeUpdate
): void {
  for (const [id, member] of update.members) {
    const node = opts.interaction.getNode(id)
    const base = press.baseRects.get(id)

    if (!node || !base) continue

    node.style.transform = composeTransform(
      member.rect.x - base.x,
      member.rect.y - base.y,
      member.rotation
    )
    node.style.width = `${member.rect.width}px`
    node.style.height = `${member.rect.height}px`
  }
}

export function runResizeFrame(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "resize" }>,
  sample: PointerSample
): void {
  const update = resolveResizeUpdateAt(opts, press, sample)

  if (!update) return

  press.lastUpdate = update
  applyResizeRects(opts, press, update)

  const { margins } = opts.editor.pageSettings
  const liveRects = new Map<string, Rect>()

  for (const [id, member] of update.members) liveRects.set(id, member.rect)

  setGestureOverlay(opts, {
    gesture: press.gesture,
    guides: resizeLimitGuides(update.limits, { top: margins.top, left: margins.left }),
    liveRects,
    marquee: null
  })

  opts.onResizeProgress(press.targets, {
    width: Math.round(update.reference.width),
    height: Math.round(update.reference.height)
  })
}

export function resolveRotateUpdateAt(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "rotate" }>,
  sample: PointerSample
): RotateUpdate | null {
  const point = contentPointAt(opts, sample)

  if (!point) return null

  return resolveRotateUpdate({
    members: press.members,
    center: press.center,
    origin: press.origin,
    point,
    snap: sample.shiftKey,
    bounds: opts.editor.bounds
  })
}

// Per-frame rotate work: every member's next rect and rotation from the same rotateSetBy the
// commit runs, written as translate+rotate transforms; the badge shows the sole member's absolute
// angle for a single-member set, else the set's applied delta.
export function runRotateFrame(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "rotate" }>,
  sample: PointerSample
): void {
  const update = resolveRotateUpdateAt(opts, press, sample)

  if (!update) return

  press.lastUpdate = update

  for (const [id, member] of update.members) {
    const node = opts.interaction.getNode(id)
    const base = press.baseRects.get(id)

    if (!node || !base) continue

    node.style.transform = composeTransform(
      member.rect.x - base.x,
      member.rect.y - base.y,
      member.rotation
    )
  }

  const liveRects = new Map<string, Rect>()

  for (const [id, member] of update.members) liveRects.set(id, member.rect)

  const sole = update.members.size === 1 ? [...update.members.values()][0] : undefined
  const degrees = sole ? sole.rotation : normalizeDegrees(update.degrees)

  setGestureOverlay(opts, {
    gesture: press.gesture,
    guides: [],
    liveRects,
    marquee: null,
    rotationBadge: degrees
  })

  opts.onRotateProgress(press.targets, degrees)
}
