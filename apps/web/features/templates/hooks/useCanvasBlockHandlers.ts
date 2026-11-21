"use client"

import { useEffect, useMemo, useRef } from "react"

import { GRID_SIZE } from "../schemas"
import { descendInto } from "../services"

import { type TemplateEditorState } from "./useTemplateEditor"

export type CanvasBlockHandlers = {
  onSyncMinHeight: (id: string, minHeight: number) => void
  onSelect: (id: string) => void
  onSetTextContent: (id: string, html: string) => void
  // Ids rather than a single id: the arrow-key gesture moves the whole multi-selection as one
  // unit when the focused block is a member of one (CanvasBlockHotkeys decides the set). onRemove
  // shares that same multi-selection-aware shape for the Delete/Backspace key.
  onNudge: (ids: readonly string[], dxCells: number, dyCells: number) => void
  onMoveBy: (ids: readonly string[], dxPixels: number, dyPixels: number) => void
  onResizeBy: (id: string, dwCells: number, dhCells: number) => void
  onRemove: (ids: readonly string[]) => void
  // Returns the newly selected id (so the caller can move keyboard focus onto it), or null when the
  // block has nothing to descend into / no parent to ascend to.
  onDescend: (id: string) => string | null
  onAscend: (id: string) => string | null
}

// Referentially stable handlers for the canvas block list. Each call delegates through a ref to the
// latest editor, so identities never change across renders — a memoized CanvasBlock therefore skips
// re-rendering on every projection tick during a drag — while the calls still hit current state, so
// there is no stale-closure data loss when the block set changes without a given block's props.
export function useCanvasBlockHandlers(editor: TemplateEditorState): CanvasBlockHandlers {
  const editorRef = useRef(editor)

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  return useMemo<CanvasBlockHandlers>(
    () => ({
      onSyncMinHeight: (id, minHeight) => editorRef.current.syncBlockMinHeight(id, minHeight),
      onSelect: (id) => editorRef.current.selectBlock(id),
      onSetTextContent: (id, html) => editorRef.current.setTextContent(id, html),
      onNudge: (ids, dxCells, dyCells) =>
        editorRef.current.moveBlocks(
          ids,
          { x: dxCells * GRID_SIZE, y: dyCells * GRID_SIZE },
          `move:${ids.join("+")}`
        ),
      onMoveBy: (ids, dxPixels, dyPixels) =>
        editorRef.current.moveBlocks(ids, { x: dxPixels, y: dyPixels }, `move:${ids.join("+")}`),
      onResizeBy: (id, dwCells, dhCells) => editorRef.current.resizeBlockBy(id, dwCells, dhCells),
      onRemove: (ids) => editorRef.current.removeSelection(ids),
      onDescend: (id) => {
        const next = descendInto(editorRef.current.blockIndex, id)

        if (next) editorRef.current.selectBlock(next)

        return next
      },
      onAscend: (id) => {
        const parentId = editorRef.current.blockIndex.get(id)?.parentId ?? null

        if (parentId) editorRef.current.selectBlock(parentId)

        return parentId
      }
    }),
    []
  )
}
