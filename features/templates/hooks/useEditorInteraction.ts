"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { type ActiveGesture } from "../components/TemplateEditorPage/engine/gestures"
import { rectsEqual } from "../components/TemplateEditorPage/engine/pressState"
import { type GuideLine, type Point, type Rect } from "../services"

import { type TemplateEditorState } from "./useTemplateEditor"

// The ephemeral interaction store: never undo-tracked, never re-rendering
// blocks per frame. Gesture progress lives in a ref-backed overlay snapshot consumed through a
// subscription (useSyncExternalStore in LiveOverlay); block nodes register their DOM elements so
// the engine writes in-flight transforms imperatively. Selection stays ordinary React state — it
// re-renders the chrome and panel, not the world — and the document store's single selected id is
// the source of truth, exposed here as the ReadonlySet the engine consumes.

export type InteractionOverlay = {
  gesture: ActiveGesture | null
  guides: readonly GuideLine[]
  // The current per-member rect during a live move/resize gesture, recomputed and pushed here
  // every rAF frame alongside the DOM writes; null while idle, when LiveOverlay derives the
  // selection chrome from the committed blockIndex instead.
  liveRects: ReadonlyMap<string, Rect> | null
  // The layers panel's hovered row, mapped to a canvas highlight; never a selection change.
  hoveredId: string | null
  // The live marquee rect while a marquee drag is in progress, in the same content-space
  // coordinates as every block's pageRect; null outside of an armed-and-moved marquee press.
  marquee: Rect | null
  // The degrees value the rotate gesture's live badge shows, pushed each frame; null outside of
  // an active rotate gesture.
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
  // Focuses a block's selection surface, deferring to the next commit when the target doesn't exist
  // yet (a container just created by group/wrap, or a child just freed by ungroup) - the caller that
  // just replaced the old top-level blocks with it has no synchronous DOM node to focus.
  focusNode: (id: string | null) => void
  setOverlay: (next: InteractionOverlay) => void
  getOverlay: () => InteractionOverlay
  subscribeOverlay: (listener: () => void) => () => void
  // The text leaf currently in inline edit mode, and the client point (if any) the entry gesture
  // carried - the double-click's coordinates for native caret placement, null for a keyboard entry
  // (Enter always places the caret at the end). Ordinary React state: entering/exiting edit mode is
  // a rare transition, not a per-frame one, so it re-renders the tree the same way selection does.
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

  const nodesRef = useRef(new Map<string, HTMLElement>())
  const pendingFocusIdRef = useRef<string | null>(null)

  useEffect(() => {
    editorRef.current = editor

    const pendingId = pendingFocusIdRef.current

    if (pendingId === null) return

    pendingFocusIdRef.current = null
    focusBlockSurface(nodesRef.current, pendingId)
  }, [editor])

  const overlayRef = useRef<InteractionOverlay>(IDLE_OVERLAY)
  const listenersRef = useRef(new Set<() => void>())
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

  const registerNode = useCallback((id: string, element: HTMLElement | null) => {
    if (element === null) {
      nodesRef.current.delete(id)
    } else {
      nodesRef.current.set(id, element)
    }
  }, [])

  const getNode = useCallback((id: string) => nodesRef.current.get(id) ?? null, [])

  // Always deferred to the effect below rather than attempted immediately: the caller (group, wrap,
  // ungroup) just committed a document change, and even an id that already happens to be registered
  // right now (a freed child reclaiming its pre-group id) is about to be unmounted and remounted at
  // a new tree position, so focusing it synchronously would only lose the focus it just set.
  const focusNode = useCallback((id: string | null) => {
    pendingFocusIdRef.current = id
  }, [])

  const setOverlay = useCallback((next: InteractionOverlay) => {
    if (overlaysEqual(overlayRef.current, next)) return

    overlayRef.current = next

    for (const listener of listenersRef.current) listener()
  }, [])

  const setHovered = useCallback(
    (id: string | null) => {
      setOverlay({ ...overlayRef.current, hoveredId: id })
    },
    [setOverlay]
  )

  const getOverlay = useCallback(() => overlayRef.current, [])

  const subscribeOverlay = useCallback((listener: () => void) => {
    listenersRef.current.add(listener)

    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

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

// Looks up a block's registered wrapper and focuses its selection-surface button; true when a
// surface was found and focused (locked/hidden blocks render no button and report false). Shared by
// focusNode's immediate attempt and the pending-commit retry in the effect above, so both paths
// agree on what "found" means.
function focusBlockSurface(nodes: ReadonlyMap<string, HTMLElement>, id: string): boolean {
  const button = nodes.get(id)?.querySelector("button")

  if (!button) return false

  button.focus()

  return true
}

// Skipping notification when nothing overlay-visible changed is what keeps a steady drag at zero
// React commits per frame: same gesture object and value-equal guides produce no re-render. A new
// liveRects Map is created every frame a gesture is active, so its reference alone (not a deep
// value compare) is enough to trigger LiveOverlay's per-frame re-render.
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
