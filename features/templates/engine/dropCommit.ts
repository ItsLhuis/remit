import { blocksInMarquee, rectFromPoints, type Point, type Rect } from "../services"

import { contentPointAt, setGestureOverlay, type UseCanvasEngineOptions } from "./frameTick"
import { reparentTargetAt, resolveMarqueeSelection, type MoveUpdate } from "./gestures"
import { type PointerSample, type PressState } from "./pressState"

// The pointerup decisions that need only the engine options and the final press state, with no
// engine closures. useCanvasEngine owns the lifecycle around these calls.

// Candidates come from the whole final rect rather than a per-frame approximation. Focuses the
// first resulting block, so an immediate arrow-key nudge has something to move.
export function commitMarquee(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "empty" }>,
  sample: Pick<PointerSample, "clientX" | "clientY">
): void {
  const point = contentPointAt(opts, sample)
  const rect = rectFromPoints(press.origin, point ?? press.origin)
  const candidates = blocksInMarquee(opts.editor.blockIndex, rect, { nested: press.nested })
  const nextSelection = resolveMarqueeSelection(
    opts.interaction.selection,
    candidates,
    press.additive
  )

  opts.interaction.setSelection(nextSelection)
  setGestureOverlay(opts, { gesture: null, guides: [], liveRects: null, marquee: null })
  opts.onMarqueeSelect(nextSelection)

  const lead = nextSelection[0]

  if (lead !== undefined) opts.interaction.getNode(lead)?.querySelector("button")?.focus()
}

// Every drop checks for a reparent target first. The reparent service guards the whole set at
// once, refusing the entire batch rather than reparenting a subset, and an illegal reparent falls
// through to a plain move for every dragged member.
export function commitMoveDrop(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "move" }>,
  update: MoveUpdate,
  sample: Pick<PointerSample, "clientX" | "clientY">
): boolean {
  const reparented = commitReparent(opts, press, update, contentPointAt(opts, sample))

  if (reparented) return true

  if (update.delta.x === 0 && update.delta.y === 0) return false

  opts.editor.moveBlocks(press.ids, update.delta)

  return true
}

function commitReparent(
  opts: UseCanvasEngineOptions,
  press: Extract<PressState, { kind: "move" }>,
  update: MoveUpdate,
  dropPoint: Point | null
): boolean {
  if (!dropPoint) return false

  const droppedRects = new Map<string, Rect>()
  const currentParentIds = new Map<string, string | null>()

  for (const id of press.ids) {
    const rect = update.rects.get(id)
    const entry = opts.editor.blockIndex.get(id)

    if (!rect || !entry) return false

    droppedRects.set(id, rect)
    currentParentIds.set(id, entry.parentId)
  }

  const target = reparentTargetAt(opts.editor.blockIndex, dropPoint, new Set(press.ids))
  const changesParent = [...currentParentIds.values()].some((parentId) => parentId !== target)

  if (!changesParent) return false

  return opts.editor.reparentBlock(press.ids, target, droppedRects)
}
