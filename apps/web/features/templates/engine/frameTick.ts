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

// Turns the current press plus the latest pointer sample into this frame's geometry and writes it
// straight to the registered block nodes, at most once per rAF tick with no document-store round
// trip. Every function takes already-dereferenced arguments rather than a React ref, so no ref
// crosses the module boundary: useCanvasEngine owns the refs, classification, arming, and commit.

export function contentPointAt(
  opts: UseCanvasEngineOptions,
  sample: { clientX: number; clientY: number }
): Point | null {
  const page = opts.pageRef.current

  if (!page) return null

  return toContentPoint(sample, page, opts.editor.zoom, opts.editor.pageSettings.margins)
}

// A gesture in progress and a hovered layers row are independent bits of ephemeral state.
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

  // Null for a move: handles are hidden during one, so nothing overlay-visible needs the per-frame
  // rects, and a fresh Map would re-render LiveOverlay and break the zero-commits-per-frame
  // invariant the move path guarantees.
  setGestureOverlay(opts, { gesture: press.gesture, guides, liveRects: null, marquee: null })

  const lead = press.ids[0] === undefined ? undefined : update.rects.get(press.ids[0])

  if (lead) opts.onMoveProgress(press.ids, { x: lead.x, y: lead.y })
}

// In the same content-space coordinates as every block's pageRect, so LiveOverlay positions it
// exactly like the rest of the chrome.
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

// Position via transform against the base rect, the same channel a move uses, and size via inline
// width/height. Zero React commits per frame.
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

// Runs the same rotateSetBy the commit runs. The badge shows a sole member's absolute angle, or
// the set's applied delta for a multi-member set.
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
