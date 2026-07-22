"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { useHotkey, useKeyHold } from "@tanstack/react-hotkeys"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { ContextMenu, ContextMenuTrigger, Typography } from "@/components/ui"

import {
  useCanvasBlockHandlers,
  useSnapBypass,
  type EditorInteraction,
  type TemplateEditorState
} from "../../hooks"
import { BLOCK_LABEL_KEYS } from "../../labels"
import { GRID_SIZE, type TemplateType } from "../../schemas"
import {
  getPageHeight,
  getPageWidth,
  hitTestBlocks,
  type Point,
  type TemplateRenderData
} from "../../services"

import { CanvasBlock, CANVAS_INSTRUCTIONS_ID } from "./CanvasBlock"
import { CanvasContextMenu } from "./CanvasContextMenu"
import { announce, shouldAnnounceGestureProgress } from "./engine/announcer"
import { toContentPoint } from "./engine/canvasPoint"
import { LiveOverlay } from "./engine/LiveOverlay"
import { LiveRegion } from "./engine/LiveRegion"
import { useCanvasEngine } from "./engine/useCanvasEngine"
import { nextZoomForWheelDelta, resolveZoomAtPointerScroll } from "./engine/zoomAtPointer"

export type CanvasTool = "select" | "pan"

type EditorCanvasProps = {
  editor: TemplateEditorState
  interaction: EditorInteraction
  type: TemplateType
  renderData: TemplateRenderData
  assets: Record<string, string>
  gridVisible: boolean
  tool: CanvasTool
  fitCounter: number
  disabled?: boolean
  onRenameBlockRequest: (id: string) => void
}

// The page renders the document's real output, so it stays white with dark ink in both app themes
// and draws its grid with a fixed light hairline instead of theme tokens.
const PAGE_GRID_STYLE = {
  backgroundImage: "radial-gradient(circle, oklch(0.87 0 0) 1px, transparent 1px)",
  backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
}

// The single canvas host: the pointer engine's handlers, the wheel-zoom anchor effect, the
// commit-render transform teardown, the live overlay and the context menu all close over the same
// scroll/page refs and gesture state, so splitting it only threads those refs through props.
// react-doctor-disable-next-line no-giant-component
const EditorCanvas = ({
  editor,
  interaction,
  type,
  renderData,
  assets,
  gridVisible,
  tool,
  fitCounter,
  disabled,
  onRenameBlockRequest
}: EditorCanvasProps) => {
  const { t } = useTranslation()

  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  const [contextPoint, setContextPoint] = useState<Point | null>(null)

  // Alt held during a drag bypasses grid snapping; the engine reads this getter live per frame.
  const isSnapBypassed = useSnapBypass()

  const isSpaceHeld = useKeyHold("Space")

  // Stable per-block callbacks so the memoized CanvasBlock never re-renders from handler identity.
  const blockHandlers = useCanvasBlockHandlers(editor)

  const pageWidth = getPageWidth(type)
  const { margins } = editor.pageSettings
  const { blocks, bounds } = editor

  const pageHeight = getPageHeight(blocks, type, editor.pageSettings)

  const nameFor = (ids: readonly string[]): string => {
    const first = ids[0] === undefined ? undefined : editor.blockIndex.get(ids[0])

    return first ? t(BLOCK_LABEL_KEYS[first.block.type]) : ""
  }

  // useCanvasEngine takes a fresh options object every render on purpose: it mirrors it into a ref
  // and builds the engine once with an empty dep array, so the pointer handlers stay referentially
  // stable while still reading current editor state. Memoizing only moves the churn one level up.
  // react-doctor-disable-next-line no-effect-with-fresh-deps
  // react-doctor-disable-next-line exhaustive-deps
  const engine = useCanvasEngine({
    editor,
    interaction,
    pageRef,
    scrollRef,
    panToolActive: tool === "pan",
    spaceHeld: isSpaceHeld,
    disabled: disabled === true,
    isSnapBypassed,
    onGestureStart: (ids) => announce(t("templates.editor.gesture.start", { name: nameFor(ids) })),
    onGestureEnd: (ids, position: Point) =>
      announce(
        t("templates.editor.gesture.end", {
          name: nameFor(ids),
          position: `${position.x}, ${position.y}`
        })
      ),
    onGestureCancel: (ids) =>
      announce(t("templates.editor.gesture.cancel", { name: nameFor(ids) })),
    onEnterTextEdit: (id) =>
      announce(t("templates.editor.textEdit.enter", { name: nameFor([id]) })),
    onMarqueeSelect: (ids) =>
      announce(t("templates.editor.selection.marquee", { count: ids.length })),
    onMoveProgress: (ids, position) => {
      if (!shouldAnnounceGestureProgress()) return

      announce(
        t("templates.editor.gesture.move", {
          name: nameFor(ids),
          position: `${position.x}, ${position.y}`
        })
      )
    },
    onResizeProgress: (ids, size) => {
      if (!shouldAnnounceGestureProgress()) return

      announce(
        t("templates.editor.gesture.resize", {
          name: nameFor(ids),
          width: size.width,
          height: size.height
        })
      )
    },
    onRotateProgress: (ids, degrees) => {
      if (!shouldAnnounceGestureProgress()) return

      announce(t("templates.editor.gesture.rotate", { name: nameFor(ids), degrees }))
    },
    onMarqueeProgress: (count) => {
      if (!shouldAnnounceGestureProgress()) return

      announce(t("templates.editor.selection.marquee", { count }))
    },
    onMarqueeCancel: () => announce(t("templates.editor.selection.marqueeCancel"))
  })

  // The flicker-killing teardown ordering: the pointerup commit renders the new
  // rects, and this layout effect — running with that commit render, after DOM mutation, before
  // paint — removes the in-flight transforms. No frame paints the pre-drag rectangle.
  useLayoutEffect(() => {
    engine.clearCommittedTransforms()
  })

  // Disabled while a block's text is being edited: the inline editing surface owns Escape itself
  // (closing its merge-variable popover on the first press, committing and exiting on the next),
  // and this hotkey's target-scoped listener would otherwise race it for the same keypress.
  useHotkey(
    "Escape",
    () => {
      if (!engine.cancelGesture()) interaction.select(null)
    },
    { target: scrollRef, enabled: interaction.editingTextId === null }
  )

  // The native "contextmenu" listener below reads through this ref (refreshed every render, no
  // dependency array) so the listener itself attaches exactly once. Imperative, not a JSX
  // onContextMenu prop: right-click's "select what's under the cursor" is canvas-surface behavior,
  // not a widget interaction, and jsx-a11y's static-interactive-element check only inspects JSX
  // attributes, never DOM listeners attached this way.
  const contextMenuStateRef = useRef({ editor, interaction, disabled })

  useEffect(() => {
    contextMenuStateRef.current = { editor, interaction, disabled }
  })

  // Resolves "the selection under the cursor" before the context menu opens: a hit keeps the
  // current selection when it's already a member (preserving a multi-selection right-click), else
  // becomes the sole selection; no hit clears it, opening the page-level menu.
  useEffect(() => {
    const scroll = scrollRef.current

    if (!scroll) return

    const handleContextMenu = (event: MouseEvent) => {
      const state = contextMenuStateRef.current
      const page = pageRef.current

      if (state.disabled || !page) return

      const point = toContentPoint(
        event,
        page,
        state.editor.zoom,
        state.editor.pageSettings.margins
      )

      setContextPoint(point)

      const topHit = hitTestBlocks(state.editor.blockIndex, point)[0] ?? null

      if (topHit !== null && state.interaction.selection.has(topHit)) return

      state.interaction.select(topHit)
    }

    scroll.addEventListener("contextmenu", handleContextMenu)

    return () => scroll.removeEventListener("contextmenu", handleContextMenu)
  }, [])

  // The latest setZoom lives in a ref so the fit effect depends only on its real trigger
  // (fitCounter) without closing over a stale editor state object.
  const setZoomRef = useRef(editor.setZoom)

  useEffect(() => {
    setZoomRef.current = editor.setZoom
  }, [editor.setZoom])

  // The last-handled counter initializes to the mount-time value, so remounting the canvas (the
  // preview toggle) never re-runs a fit that would clobber the preserved zoom; only a new
  // fit-to-view request does.
  const lastFitRef = useRef(fitCounter)

  useEffect(() => {
    if (fitCounter === lastFitRef.current || !scrollRef.current) return

    lastFitRef.current = fitCounter

    const available = scrollRef.current.clientWidth - 96

    setZoomRef.current(available / pageWidth)
  }, [fitCounter, pageWidth])

  // Ctrl/Cmd+wheel zoom-at-pointer: the wheel handler stashes the pointer/scroll anchor (read
  // through a ref refreshed every render, same pattern as contextMenuStateRef) and requests the new
  // zoom; editor.setZoom clamps internally, so a layout effect keyed to the zoom that actually took
  // effect resolves the matching scroll offset once the new scale has painted, before the browser
  // shows a frame at the wrong scroll position.
  const zoomWheelStateRef = useRef({ zoom: editor.zoom, setZoom: editor.setZoom })

  useEffect(() => {
    zoomWheelStateRef.current = { zoom: editor.zoom, setZoom: editor.setZoom }
  })

  const pendingZoomAnchorRef = useRef<{
    pointer: Point
    containerOrigin: Point
    scroll: Point
    previousZoom: number
  } | null>(null)

  useEffect(() => {
    const scroll = scrollRef.current

    if (!scroll) return

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return

      event.preventDefault()

      const state = zoomWheelStateRef.current
      const containerRect = scroll.getBoundingClientRect()

      const anchor = {
        pointer: { x: event.clientX, y: event.clientY },
        containerOrigin: { x: containerRect.left, y: containerRect.top },
        scroll: { x: scroll.scrollLeft, y: scroll.scrollTop },
        previousZoom: state.zoom
      }

      pendingZoomAnchorRef.current = anchor

      state.setZoom(nextZoomForWheelDelta(state.zoom, event.deltaY))

      // A wheel tick at the zoom clamp is a no-op state set: React bails the render entirely, so
      // the layout effect below never runs to consume/clear this anchor. Left stale, the next
      // unrelated zoom change (toolbar, hotkey, fit) would misapply it. One rAF is enough for a
      // real zoom change's layout effect to have already claimed it; if it's still this same
      // anchor after that frame, this tick clamped to a no-op and the anchor must be dropped.
      requestAnimationFrame(() => {
        if (pendingZoomAnchorRef.current === anchor) pendingZoomAnchorRef.current = null
      })
    }

    scroll.addEventListener("wheel", handleWheel, { passive: false })

    return () => scroll.removeEventListener("wheel", handleWheel)
  }, [])

  useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current
    const scroll = scrollRef.current

    pendingZoomAnchorRef.current = null

    if (!anchor || !scroll || editor.zoom === anchor.previousZoom) return

    const next = resolveZoomAtPointerScroll({ ...anchor, nextZoom: editor.zoom })

    scroll.scrollLeft = next.x
    scroll.scrollTop = next.y
  }, [editor.zoom])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={scrollRef}
          className={cn(
            "bg-muted min-h-0 flex-1 overflow-auto select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            (tool === "pan" || isSpaceHeld) && "cursor-grab active:cursor-grabbing"
          )}
          {...engine.handlers}
        >
          <div className="flex justify-center px-16 py-12">
            <div
              className="relative"
              style={{ width: pageWidth * editor.zoom, height: pageHeight * editor.zoom }}
            >
              <div style={{ transform: `scale(${editor.zoom})`, transformOrigin: "top left" }}>
                <div
                  ref={pageRef}
                  className="relative shrink-0 bg-white text-neutral-950 ring-1 ring-neutral-950/10"
                  style={{
                    width: pageWidth,
                    height: pageHeight,
                    ...(gridVisible ? PAGE_GRID_STYLE : {})
                  }}
                >
                  {blocks.length === 0 ? (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
                      <Typography affects="medium" className="text-neutral-950">
                        {t("templates.editor.emptyCanvasTitle")}
                      </Typography>
                      <Typography affects="small" className="text-neutral-500">
                        {t("templates.editor.emptyCanvasDescription")}
                      </Typography>
                    </div>
                  ) : null}
                  {blocks.map((block) => (
                    <CanvasBlock
                      key={block.id}
                      block={block}
                      margins={margins}
                      type={type}
                      renderData={renderData}
                      assets={assets}
                      disabled={disabled}
                      interaction={interaction}
                      onRegisterNode={interaction.registerNode}
                      {...blockHandlers}
                    />
                  ))}
                </div>
              </div>
              <LiveOverlay
                interaction={interaction}
                blockIndex={editor.blockIndex}
                bounds={bounds}
                margins={margins}
                pageHeight={pageHeight}
                zoom={editor.zoom}
                disabled={disabled}
              />
            </div>
          </div>
          <span id={CANVAS_INSTRUCTIONS_ID} className="sr-only">
            {t("templates.editor.gesture.instructions")}
          </span>
          <LiveRegion />
        </div>
      </ContextMenuTrigger>
      <CanvasContextMenu
        editor={editor}
        interaction={interaction}
        cursorPoint={contextPoint}
        disabled={disabled}
        onRenameRequest={onRenameBlockRequest}
      />
    </ContextMenu>
  )
}

export { EditorCanvas }
