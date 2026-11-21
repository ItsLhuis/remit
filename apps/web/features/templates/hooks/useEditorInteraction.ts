"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { rectsEqual, type ActiveGesture } from "../engine"
import { type GuideLine, type Point, type Rect } from "../services"

import { type TemplateEditorState } from "./useTemplateEditor"

// The ephemeral interaction store: never undo-tracked, never re-rendering blocks per frame.
// Gesture progress is a ref-backed snapshot consumed through useSyncExternalStore, and block nodes
// register their DOM elements so the engine can write transforms imperatively. Selection stays
// ordinary React state, since it re-renders the chrome and panel rather than the world.

export type InteractionOverlay = {
  gesture: ActiveGesture | null
  guides: readonly GuideLine[]
  // Pushed every rAF frame alongside the DOM writes. Null while idle, when LiveOverlay derives the
  // chrome from the committed blockIndex instead.
  liveRects: ReadonlyMap<string, Rect> | null
  // The layers panel's hovered row, mapped to a canvas highlight; never a selection change.
  hoveredId: string | null
  // In the same content-space coordinates as every block's pageRect.
  marquee: Rect | null
  // The rotate badge's degrees, pushed each frame.
  rotationBadge: number | null
}

export type EditorInteraction = {
  selection: ReadonlySet<string>
  select: (id: string | null) => void
  toggleSelected: (id: string) => void
  setSelection: (ids: readonly string[]) => void
  setHovered: (id: string | null) => void
  registerNode: (id: string, element: HTMLElement | null) => void
  getNode: (id: string) => HTMLElement | null
  // Defers to the next commit: a container just created by group/wrap, or a child just freed by
  // ungroup, has no DOM node yet for its caller to focus synchronously.
  focusNode: (id: string | null) => void
  setOverlay: (next: InteractionOverlay) => void
  getOverlay: () => InteractionOverlay
  subscribeOverlay: (listener: () => void) => () => void
  // The point is the double-click's coordinates for native caret placement, null for a keyboard
  // entry, which always places the caret at the end. Ordinary React state, since entering and
  // exiting edit mode is a rare transition rather than a per-frame one.
  editingTextId: string | null
  editingTextCaretPoint: Point | null
  startTextEdit: (id: string, caretPoint?: Point | null) => void
  endTextEdit: () => void
}

const IDLE_OVERLAY: InteractionOverlay = {
  gesture: null,
  guides: [],
  liveRects: null,
  hoveredId: null,
  marquee: null,
  rotationBadge: null
}

export function useEditorInteraction(editor: TemplateEditorState): EditorInteraction {
  const editorRef = useRef(editor)

  // Lazy useState, not useRef(new Map()): both hold a stable, never-re-rendered identity, but a
  // useRef initializer would rebuild and discard the collection on every render, and reading
  // ref.current back during render is not allowed.
  const [nodes] = useState<Map<string, HTMLElement>>(() => new Map())

  const pendingFocusIdRef = useRef<string | null>(null)

  useEffect(() => {
    editorRef.current = editor

    const pendingId = pendingFocusIdRef.current

    if (pendingId === null) return

    pendingFocusIdRef.current = null
    focusBlockSurface(nodes, pendingId)
  }, [editor, nodes])

  const overlayRef = useRef<InteractionOverlay>(IDLE_OVERLAY)

  const [listeners] = useState<Set<() => void>>(() => new Set())

  const [editingText, setEditingText] = useState<{ id: string; caretPoint: Point | null } | null>(
    null
  )

  const selection = useMemo<ReadonlySet<string>>(
    () => new Set(editor.selectedIds),
    [editor.selectedIds]
  )

  const select = useCallback((id: string | null) => {
    editorRef.current.selectBlock(id)
  }, [])

  const toggleSelected = useCallback((id: string) => {
    editorRef.current.toggleSelection(id)
  }, [])

  const setSelection = useCallback((ids: readonly string[]) => {
    editorRef.current.setSelection(ids)
  }, [])

  const registerNode = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (element === null) {
        nodes.delete(id)
      } else {
        nodes.set(id, element)
      }
    },
    [nodes]
  )

  const getNode = useCallback((id: string) => nodes.get(id) ?? null, [nodes])

  // Always deferred, never attempted immediately: even an id registered right now (a freed child
  // reclaiming its pre-group id) is about to remount at a new tree position, so focusing it
  // synchronously would only lose the focus it just set.
  const focusNode = useCallback((id: string | null) => {
    pendingFocusIdRef.current = id
  }, [])

  const setOverlay = useCallback(
    (next: InteractionOverlay) => {
      if (overlaysEqual(overlayRef.current, next)) return

      overlayRef.current = next

      for (const listener of listeners) listener()
    },
    [listeners]
  )

  const setHovered = useCallback(
    (id: string | null) => {
      setOverlay({ ...overlayRef.current, hoveredId: id })
    },
    [setOverlay]
  )

  const getOverlay = useCallback(() => overlayRef.current, [])

  const subscribeOverlay = useCallback(
    (listener: () => void) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    [listeners]
  )

  const startTextEdit = useCallback((id: string, caretPoint: Point | null = null) => {
    setEditingText({ id, caretPoint })
  }, [])

  const endTextEdit = useCallback(() => setEditingText(null), [])

  return useMemo(
    () => ({
      selection,
      select,
      toggleSelected,
      setSelection,
      setHovered,
      registerNode,
      getNode,
      focusNode,
      setOverlay,
      getOverlay,
      subscribeOverlay,
      editingTextId: editingText?.id ?? null,
      editingTextCaretPoint: editingText?.caretPoint ?? null,
      startTextEdit,
      endTextEdit
    }),
    [
      selection,
      select,
      toggleSelected,
      setSelection,
      setHovered,
      registerNode,
      getNode,
      focusNode,
      setOverlay,
      getOverlay,
      subscribeOverlay,
      editingText,
      startTextEdit,
      endTextEdit
    ]
  )
}

// False for a locked or hidden block, which renders no button. Shared by focusNode's immediate
// attempt and the pending-commit retry above, so both agree on what "found" means.
function focusBlockSurface(nodes: ReadonlyMap<string, HTMLElement>, id: string): boolean {
  const button = nodes.get(id)?.querySelector("button")

  if (!button) return false

  button.focus()

  return true
}

// Skipping notification when nothing overlay-visible changed is what keeps a steady drag at zero
// React commits per frame. liveRects is a new Map every active frame, so its reference alone is
// enough to trigger LiveOverlay's re-render.
function overlaysEqual(a: InteractionOverlay, b: InteractionOverlay): boolean {
  if (a.gesture !== b.gesture) return false

  if (a.liveRects !== b.liveRects) return false

  if (a.hoveredId !== b.hoveredId) return false

  if (a.rotationBadge !== b.rotationBadge) return false

  if (a.marquee === null || b.marquee === null) {
    if (a.marquee !== b.marquee) return false
  } else if (!rectsEqual(a.marquee, b.marquee)) {
    return false
  }

  if (a.guides.length !== b.guides.length) return false

  return a.guides.every((guide, position) => {
    const other = b.guides[position]

    return (
      guide.key === other?.key &&
      guide.orientation === other.orientation &&
      guide.at === other.at &&
      guide.emphasis === other.emphasis
    )
  })
}
