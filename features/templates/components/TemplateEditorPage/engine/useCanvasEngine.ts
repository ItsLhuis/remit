"use client"

import {
  useEffect,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react"

import {
  collectRotationMembers,
  cursorForHandle,
  enclosingFrameRect,
  isUniformOnly,
  type HandleDirection,
  type Point,
  type Rect
} from "../../../services"

import { resetGestureProgressThrottle } from "./announcer"
import { commitMarquee, commitMoveDrop } from "./dropCommit"
import {
  contentPointAt,
  resolveResizeUpdateAt,
  resolveRotateUpdateAt,
  resolveUpdateAt,
  runMarqueeFrame,
  runMoveFrame,
  runResizeFrame,
  runRotateFrame,
  setGestureOverlay,
  applyResizeRects,
  type UseCanvasEngineOptions
} from "./frameTick"
import {
  classifyPress,
  collectResizeSet,
  descendAt,
  textEditTargetAt,
  type PressClassification
} from "./gestures"
import {
  capturePointer,
  clearNodeTransforms,
  handleDirectionAt,
  isRotateZoneTarget,
  isTextEditSurfaceTarget,
  pastThreshold,
  rectsEqual,
  restoreNodeRects,
  ROTATE_CURSOR,
  type PointerSample,
  type PressState
} from "./pressState"

// The canvas pointer engine: classifies every gesture at pointerdown, batches pointermove work
// into one rAF callback that delegates to frameTick.ts for the per-frame math and DOM writes, and
// commits to the document store exactly once at pointerup. The commit's inline styles are cleared
// by EditorCanvas in a layout effect keyed to the commit render, so no frame ever paints without
// either the transform or the committed geometry.

export type CanvasEngineHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void
  onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void
}

export type CanvasEngine = {
  handlers: CanvasEngineHandlers
  cancelGesture: () => boolean
  clearCommittedTransforms: () => void
}

export function useCanvasEngine(options: UseCanvasEngineOptions): CanvasEngine {
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const pressRef = useRef<PressState | null>(null)
  const frameRef = useRef<number | null>(null)
  const lastMoveRef = useRef<PointerSample | null>(null)
  // The transforms to clear after the commit render paints, keyed to each member's JUST-committed
  // rotation. The rotation is captured at commit time because the clearing layout effect runs
  // before optionsRef refreshes — reading the block index there would see the stale pre-commit
  // rotation and wipe the transform React just painted.
  const pendingClearRef = useRef<ReadonlyMap<string, number> | null>(null)

  const engine = useMemo<CanvasEngine>(() => {
    // Clearing/restoring always re-applies the block's committed rotation from the CURRENT block
    // index — after a commit that is the just-committed value, after a cancel the untouched
    // pre-gesture one.
    const committedRotationOf = (id: string) =>
      optionsRef.current.editor.blockIndex.get(id)?.rotation ?? 0

    const clearTransforms = (ids: readonly string[]) => {
      clearNodeTransforms(optionsRef.current.interaction.getNode, ids, committedRotationOf)
    }

    const restoreBaseRects = (baseRects: ReadonlyMap<string, Rect>) => {
      restoreNodeRects(optionsRef.current.interaction.getNode, baseRects, committedRotationOf)
    }

    const setContainerCursor = (cursor: string) => {
      const scroll = optionsRef.current.scrollRef.current

      if (scroll) scroll.style.cursor = cursor
    }

    const cancelFrame = () => {
      if (frameRef.current === null) return

      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    const runFrame = () => {
      frameRef.current = null

      const press = pressRef.current
      const sample = lastMoveRef.current

      if (!sample || !press) return

      const opts = optionsRef.current

      if (press.kind === "move" && press.activated) runMoveFrame(opts, press, sample)
      if (press.kind === "resize" && press.activated) runResizeFrame(opts, press, sample)
      if (press.kind === "rotate" && press.activated) runRotateFrame(opts, press, sample)
      if (press.kind === "empty" && press.moved) runMarqueeFrame(opts, press, sample)
    }

    const finishGesture = () => {
      cancelFrame()
      lastMoveRef.current = null
      resetGestureProgressThrottle()
      window.removeEventListener("blur", handleWindowBlur)
    }

    // Escape with no press in progress falls through to clearing the selection (returns
    // false); Escape mid-press consumes the key and cancels only that press (returns true) — a
    // pan or an armed-but-unactivated press is simply dropped, and only an activated gesture
    // needs the full teardown (transforms/sizes, overlay, cursor, announcer).
    const cancelGesture = (): boolean => {
      const press = pressRef.current

      if (press === null) return false

      pressRef.current = null

      if (press.kind === "empty" && press.moved) {
        finishGesture()
        setGestureOverlay(optionsRef.current, {
          gesture: null,
          guides: [],
          liveRects: null,
          marquee: null
        })
        optionsRef.current.onMarqueeCancel()

        return true
      }

      if (
        (press.kind !== "move" && press.kind !== "resize" && press.kind !== "rotate") ||
        !press.activated
      ) {
        return true
      }

      finishGesture()

      if (press.kind === "move") {
        clearTransforms(press.ids)
        setContainerCursor("")
      } else if (press.kind === "rotate") {
        clearTransforms(press.members.map((member) => member.id))
        setContainerCursor("")
      } else {
        restoreBaseRects(press.baseRects)
        setContainerCursor("")
      }

      setGestureOverlay(optionsRef.current, {
        gesture: null,
        guides: [],
        liveRects: null,
        marquee: null
      })
      optionsRef.current.onGestureCancel(press.kind === "move" ? press.ids : press.targets)

      return true
    }

    const handleWindowBlur = () => {
      cancelGesture()
    }

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      const opts = optionsRef.current

      if (opts.disabled || pressRef.current !== null) return
      if (isTextEditSurfaceTarget(event.target)) return
      if (event.button !== 0 && event.button !== 1) return

      const scroll = opts.scrollRef.current

      if (!scroll) return

      if (opts.panToolActive || event.button === 1 || opts.spaceHeld) {
        pressRef.current = {
          kind: "pan",
          pointerId: event.pointerId,
          startClient: { x: event.clientX, y: event.clientY },
          startScroll: { x: scroll.scrollLeft, y: scroll.scrollTop }
        }

        event.preventDefault()
        capturePointer(event)

        return
      }

      const point = contentPointAt(opts, event)

      if (!point) return

      // A press on a resize handle takes precedence over hit-testing blocks:
      // the handle carries its direction as a data attribute and the current selection is the
      // target set.
      const direction = handleDirectionAt(event.target)

      if (direction !== null) {
        armResizePress(direction, event, point)
        capturePointer(event)

        return
      }

      if (isRotateZoneTarget(event.target)) {
        armRotatePress(event, point)
        capturePointer(event)

        return
      }

      const classification = classifyPress({
        index: opts.editor.blockIndex,
        point,
        selection: opts.interaction.selection,
        deepSelect: event.ctrlKey || event.metaKey,
        toggle: event.shiftKey
      })

      armClassifiedPress(classification, event, point)
      capturePointer(event)
    }

    const armResizePress = (
      direction: HandleDirection,
      event: ReactPointerEvent<HTMLDivElement>,
      point: Point
    ) => {
      const opts = optionsRef.current
      const targets = [...opts.interaction.selection]
      const set = collectResizeSet(opts.editor.blockIndex, targets)

      if (!set) return

      pressRef.current = {
        kind: "resize",
        pointerId: event.pointerId,
        startClient: { x: event.clientX, y: event.clientY },
        origin: point,
        targets,
        direction,
        baseReference: set.baseReference,
        baseRotation: set.baseRotation,
        baseRects: set.baseRects,
        members: set.members,
        uniformOnly: isUniformOnly(set.members),
        clamp: targets.some((id) => opts.editor.blockIndex.get(id)?.parentId === null),
        parentRect: set.parentRect,
        activated: false,
        gesture: null,
        lastUpdate: null
      }

      event.preventDefault()
    }

    // The rotate zones only render around the explicit selection's chrome, so the current
    // selection is always the target set; collectRotationMembers expands a group into its children
    // (a group never carries rotation) and skips locked members.
    const armRotatePress = (event: ReactPointerEvent<HTMLDivElement>, point: Point) => {
      const opts = optionsRef.current
      const targets = [...opts.interaction.selection]
      const set = collectRotationMembers(opts.editor.blockIndex, targets)

      if (!set) return

      const baseRects = new Map<string, Rect>()

      for (const member of set.members) baseRects.set(member.id, member.rect)

      pressRef.current = {
        kind: "rotate",
        pointerId: event.pointerId,
        startClient: { x: event.clientX, y: event.clientY },
        origin: point,
        targets,
        members: set.members,
        baseRects,
        center: set.center,
        activated: false,
        gesture: null,
        lastUpdate: null
      }

      event.preventDefault()
    }

    const armClassifiedPress = (
      classification: PressClassification,
      event: ReactPointerEvent<HTMLDivElement>,
      point: Point
    ) => {
      const opts = optionsRef.current
      const startClient = { x: event.clientX, y: event.clientY }

      if (classification.kind === "toggle") {
        opts.interaction.toggleSelected(classification.id)
        pressRef.current = { kind: "toggle", pointerId: event.pointerId }

        return
      }

      if (classification.kind === "empty") {
        pressRef.current = {
          kind: "empty",
          pointerId: event.pointerId,
          startClient,
          origin: point,
          moved: false,
          nested: event.ctrlKey || event.metaKey,
          additive: event.shiftKey
        }

        return
      }

      if (classification.selectId !== null) opts.interaction.select(classification.selectId)

      const baseRects = new Map<string, Rect>()
      const parentRects = new Map<string, Rect>()
      const rotations = new Map<string, number>()

      for (const id of classification.ids) {
        const entry = opts.editor.blockIndex.get(id)

        if (!entry) continue

        baseRects.set(id, entry.pageRect)
        rotations.set(id, entry.rotation)

        const frameRect = enclosingFrameRect(opts.editor.blockIndex, id)

        if (frameRect) parentRects.set(id, frameRect)
      }

      pressRef.current = {
        kind: "move",
        pointerId: event.pointerId,
        startClient,
        origin: point,
        ids: classification.ids,
        activated: false,
        gesture: null,
        baseRects,
        parentRects,
        rotations,
        clamp: classification.ids.some(
          (id) => enclosingFrameRect(opts.editor.blockIndex, id) === null
        ),
        lastUpdate: null
      }
    }

    const queueFrameSample = (event: ReactPointerEvent<HTMLDivElement>) => {
      lastMoveRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        shiftKey: event.shiftKey,
        altKey: event.altKey
      }

      if (frameRef.current === null) frameRef.current = requestAnimationFrame(runFrame)
    }

    // A marquee "activates" like every other gesture: past the threshold, the press marks itself
    // moved and joins the rAF frame loop so the live rect draws once per display tick.
    const trackMarqueeMove = (
      press: Extract<PressState, { kind: "empty" }>,
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (!press.moved && pastThreshold(press.startClient, event)) {
        press.moved = true
        window.addEventListener("blur", handleWindowBlur)
      }

      if (press.moved) queueFrameSample(event)
    }

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
      const press = pressRef.current

      if (press?.pointerId !== event.pointerId) return

      const opts = optionsRef.current

      if (press.kind === "pan") {
        const scroll = opts.scrollRef.current

        if (!scroll) return

        scroll.scrollLeft = press.startScroll.x - (event.clientX - press.startClient.x)
        scroll.scrollTop = press.startScroll.y - (event.clientY - press.startClient.y)

        return
      }

      if (press.kind === "toggle") return

      if (press.kind === "empty") {
        trackMarqueeMove(press, event)

        return
      }

      if (!press.activated) {
        if (!pastThreshold(press.startClient, event)) return

        activatePress(press)
      }

      queueFrameSample(event)
    }

    const activatePress = (press: Extract<PressState, { kind: "move" | "resize" | "rotate" }>) => {
      const opts = optionsRef.current

      press.activated = true

      if (press.kind === "move") {
        press.gesture = {
          kind: "move",
          ids: press.ids,
          origin: press.origin,
          baseRects: press.baseRects
        }
        // Same reason as the resize/rotate cursors below: the captured pointer immediately leaves
        // the dragged block's own element, so its CSS active:cursor-grabbing state stops applying -
        // the container carries the grabbing cursor for the whole gesture instead.
        setContainerCursor("grabbing")
      } else if (press.kind === "rotate") {
        press.gesture = {
          kind: "rotate",
          targets: press.targets,
          origin: press.origin,
          center: press.center
        }
        setContainerCursor(ROTATE_CURSOR)
      } else {
        press.gesture = {
          kind: "resize",
          targets: press.targets,
          direction: press.direction,
          origin: press.origin,
          baseReference: press.baseReference,
          baseRotation: press.baseRotation,
          members: press.members,
          uniformOnly: press.uniformOnly
        }
        // The captured pointer leaves the handle element immediately, so the container carries
        // the directional cursor for the whole gesture.
        setContainerCursor(cursorForHandle(press.direction, press.baseRotation))
      }

      setGestureOverlay(opts, {
        gesture: press.gesture,
        guides: [],
        liveRects: null,
        marquee: null
      })
      opts.onGestureStart(press.kind === "move" ? press.ids : press.targets)
      window.addEventListener("blur", handleWindowBlur)
    }

    const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
      const press = pressRef.current

      if (press?.pointerId !== event.pointerId) return

      pressRef.current = null

      const opts = optionsRef.current

      if (press.kind === "pan" || press.kind === "toggle") return

      if (press.kind === "empty") {
        if (press.moved) {
          finishGesture()
          commitMarquee(opts, press, event)
        } else if (!pastThreshold(press.startClient, event)) {
          opts.interaction.select(null)
        }

        return
      }

      if (!press.activated) return

      finishGesture()

      const sample: PointerSample = {
        clientX: event.clientX,
        clientY: event.clientY,
        shiftKey: event.shiftKey,
        altKey: event.altKey
      }

      if (press.kind === "resize") {
        commitResizeDrop(press, sample)

        return
      }

      if (press.kind === "rotate") {
        commitRotateDrop(press, sample)

        return
      }

      setContainerCursor("")

      const update = resolveUpdateAt(opts, press, sample) ?? press.lastUpdate

      if (!update) {
        clearTransforms(press.ids)
        setGestureOverlay(opts, { gesture: null, guides: [], liveRects: null, marquee: null })
        opts.onGestureCancel(press.ids)

        return
      }

      const committed = commitMoveDrop(opts, press, update, sample)

      if (committed) {
        // Cleared by EditorCanvas's layout effect after the commit render paints the new rects.
        pendingClearRef.current = new Map(press.ids.map((id) => [id, press.rotations.get(id) ?? 0]))
      } else {
        clearTransforms(press.ids)
      }

      setGestureOverlay(opts, { gesture: null, guides: [], liveRects: null, marquee: null })

      const lead = press.ids[0] === undefined ? undefined : update.rects.get(press.ids[0])

      opts.onGestureEnd(press.ids, lead ? { x: lead.x, y: lead.y } : { x: 0, y: 0 })
    }

    // One resizeBlocks commit at pointerup: the final resolved update is
    // written to the DOM first so the commit render replaces exactly what is painted, then the
    // reference rect commits through the same document-store primitive the panel fields use.
    const commitResizeDrop = (
      press: Extract<PressState, { kind: "resize" }>,
      sample: PointerSample
    ) => {
      const opts = optionsRef.current
      const update = resolveResizeUpdateAt(opts, press, sample) ?? press.lastUpdate

      setContainerCursor("")

      if (!update || rectsEqual(update.reference, press.baseReference)) {
        restoreBaseRects(press.baseRects)
        setGestureOverlay(opts, { gesture: null, guides: [], liveRects: null, marquee: null })
        opts.onGestureCancel(press.targets)

        return
      }

      applyResizeRects(opts, press, update)
      // Pass the pre-clamp sized reference, not the already-clamped `reference`: resizeBlocks
      // re-runs its own quantize->clamp, and clamping an already-clamped off-grid rect a second
      // time can round to a different result than the preview showed (2px snap at drop).
      opts.editor.resizeBlocks(press.targets, update.sizedReference)
      pendingClearRef.current = new Map(
        [...update.members].map(([id, member]) => [id, member.rotation])
      )
      setGestureOverlay(opts, { gesture: null, guides: [], liveRects: null, marquee: null })
      opts.onGestureEnd(press.targets, { x: update.reference.x, y: update.reference.y })
    }

    // One rotateBlocks commit at pointerup: the shared-center delta commits through the same
    // resolveRotatedBlocks the per-frame preview ran, so the committed geometry is the last frame.
    const commitRotateDrop = (
      press: Extract<PressState, { kind: "rotate" }>,
      sample: PointerSample
    ) => {
      const opts = optionsRef.current
      const update = resolveRotateUpdateAt(opts, press, sample) ?? press.lastUpdate
      const memberIds = press.members.map((member) => member.id)

      setContainerCursor("")

      if (!update || update.degrees === 0) {
        clearTransforms(memberIds)
        setGestureOverlay(opts, { gesture: null, guides: [], liveRects: null, marquee: null })
        opts.onGestureCancel(press.targets)

        return
      }

      opts.editor.rotateBlocks(press.targets, update.degrees)
      pendingClearRef.current = new Map(
        [...update.members].map(([id, member]) => [id, member.rotation])
      )
      setGestureOverlay(opts, { gesture: null, guides: [], liveRects: null, marquee: null })
      opts.onGestureEnd(press.targets, press.center)
    }

    const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pressRef.current?.pointerId !== event.pointerId) return

      cancelGesture()
    }

    // Double-click descend: hit-tests at the click point independently of the DOM element actually
    // clicked (blocks may visually overlap), so it stays correct regardless of which nested block's
    // surface received the native dblclick.
    const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
      const opts = optionsRef.current

      if (opts.disabled || pressRef.current !== null) return
      if (isTextEditSurfaceTarget(event.target)) return

      const point = contentPointAt(opts, event)

      if (!point) return

      const next = descendAt(opts.editor.blockIndex, point, opts.interaction.selection)

      if (next !== null) {
        opts.interaction.select(next)

        return
      }

      const textTarget = textEditTargetAt(opts.editor.blockIndex, point, opts.interaction.selection)

      if (textTarget === null) return

      opts.interaction.startTextEdit(textTarget, { x: event.clientX, y: event.clientY })
      opts.onEnterTextEdit(textTarget)
    }

    const clearCommittedTransforms = () => {
      const pending = pendingClearRef.current

      if (!pending) return

      pendingClearRef.current = null
      clearNodeTransforms(
        optionsRef.current.interaction.getNode,
        [...pending.keys()],
        (id) => pending.get(id) ?? 0
      )
    }

    return {
      handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick },
      cancelGesture,
      clearCommittedTransforms
    }
  }, [])

  useEffect(() => {
    return () => {
      engine.cancelGesture()
    }
  }, [engine])

  return engine
}
