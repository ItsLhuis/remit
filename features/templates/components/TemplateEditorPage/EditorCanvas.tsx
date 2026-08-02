"use client"

import { useEffect, useLayoutEffect, useRef } from "react"

import { useHotkey, useKeyHold } from "@tanstack/react-hotkeys"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { ContextMenu, ContextMenuTrigger, Typography } from "@/components/ui"

import {
  LiveOverlay,
  LiveRegion,
  useCanvasAnnouncers,
  useCanvasContextMenu,
  useCanvasEngine,
  useWheelZoomAnchor
} from "../../engine"
import {
  useCanvasBlockHandlers,
  useSnapBypass,
  type EditorInteraction,
  type TemplateEditorState
} from "../../hooks"
import { GRID_SIZE, type TemplateType } from "../../schemas"
import { getPageHeight, getPageWidth, type TemplateRenderData } from "../../services"

import { CanvasBlock, CANVAS_INSTRUCTIONS_ID } from "./CanvasBlock"
import { CanvasContextMenu } from "./CanvasContextMenu"

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

// Renders the page surface and owns the two DOM refs everything else hangs off. Gesture narration,
// context-menu hit resolution, and the wheel-zoom anchor are hooks that own their own state and
// take only those refs.
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

  // Alt held during a drag bypasses grid snapping; the engine reads this getter live per frame.
  const isSnapBypassed = useSnapBypass()

  const isSpaceHeld = useKeyHold("Space")

  // Stable per-block callbacks so the memoized CanvasBlock never re-renders from handler identity.
  const blockHandlers = useCanvasBlockHandlers(editor)

  const pageWidth = getPageWidth(type)
  const { margins } = editor.pageSettings
  const { blocks, bounds } = editor

  const pageHeight = getPageHeight(blocks, type, editor.pageSettings)

  const announcers = useCanvasAnnouncers(editor)

  // A fresh object every render on purpose: useCanvasEngine mirrors it into a ref and builds once,
  // so the handlers stay stable while reading current state. Memoizing only moves the churn up.
  const engine = useCanvasEngine({
    editor,
    interaction,
    pageRef,
    scrollRef,
    panToolActive: tool === "pan",
    spaceHeld: isSpaceHeld,
    disabled: disabled === true,
    isSnapBypassed,
    ...announcers
  })

  // Runs with the commit render, after DOM mutation and before paint, so no frame ever paints the
  // pre-drag rectangle.
  useLayoutEffect(() => {
    engine.clearCommittedTransforms()
  })

  // The inline editing surface owns Escape itself, and this target-scoped listener would otherwise
  // race it for the same keypress.
  useHotkey(
    "Escape",
    () => {
      if (!engine.cancelGesture()) interaction.select(null)
    },
    { target: scrollRef, enabled: interaction.editingTextId === null }
  )

  const contextPoint = useCanvasContextMenu({ scrollRef, pageRef, editor, interaction, disabled })

  // In a ref so the fit effect depends only on fitCounter, without closing over stale state.
  const setZoomRef = useRef(editor.setZoom)

  useEffect(() => {
    setZoomRef.current = editor.setZoom
  }, [editor.setZoom])

  // Initialized to the mount-time value, so remounting the canvas never re-runs a fit that would
  // clobber the preserved zoom.
  const lastFitRef = useRef(fitCounter)

  useEffect(() => {
    if (fitCounter === lastFitRef.current || !scrollRef.current) return

    lastFitRef.current = fitCounter

    const available = scrollRef.current.clientWidth - 96

    setZoomRef.current(available / pageWidth)
  }, [fitCounter, pageWidth])

  useWheelZoomAnchor({ scrollRef, zoom: editor.zoom, setZoom: editor.setZoom })

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
