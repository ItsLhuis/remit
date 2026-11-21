"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import { type EditorInteraction, type TemplateEditorState } from "../hooks"
import { hitTestBlocks, type Point } from "../services"

import { toContentPoint } from "./canvasPoint"

type CanvasContextMenuOptions = {
  scrollRef: RefObject<HTMLDivElement | null>
  pageRef: RefObject<HTMLDivElement | null>
  editor: TemplateEditorState
  interaction: EditorInteraction
  disabled?: boolean
}

// Resolves "the selection under the cursor" before the context menu opens, and reports the cursor's
// content-space point. A hit keeps the current selection when it is already a member (preserving a
// multi-selection right-click), else becomes the sole selection; no hit clears it, opening the
// page-level menu.
//
// The native "contextmenu" listener reads through a ref refreshed every render (no dependency
// array) so the listener itself attaches exactly once. Imperative, not a JSX onContextMenu prop:
// right-click's "select what's under the cursor" is canvas-surface behavior, not a widget
// interaction, and jsx-a11y's static-interactive-element check only inspects JSX attributes, never
// DOM listeners attached this way.
export function useCanvasContextMenu({
  scrollRef,
  pageRef,
  editor,
  interaction,
  disabled
}: CanvasContextMenuOptions): Point | null {
  const [contextPoint, setContextPoint] = useState<Point | null>(null)

  const contextMenuStateRef = useRef({ editor, interaction, disabled })

  useEffect(() => {
    contextMenuStateRef.current = { editor, interaction, disabled }
  })

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
  }, [scrollRef, pageRef])

  return contextPoint
}
