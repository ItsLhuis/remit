import { type Block, type BlockStyle } from "../schemas"
import {
  applyStyleToBlock,
  duplicateBlock as duplicateBlockOnCanvas,
  extractStyle,
  findBlock,
  materializePastedBlocks,
  moveSiblingGroupToEdge,
  moveSiblingOrder,
  removeById,
  replaceById,
  serializeSelection,
  type ContentBounds,
  type Point
} from "../services"

// The in-memory clipboards: module-level (not React state, not inside services/) so a copy
// survives navigating away from and back to the editor within the same session - every editor
// instance in the tab shares one buffer, exactly like a native OS clipboard.
let clipboardBuffer: Block[] | null = null
let styleClipboardBuffer: { style: BlockStyle | undefined } | null = null

type SelectionActionsContext = {
  blocks: Block[]
  bounds: ContentBounds
  selectedIds: string[]
  commitBlocks: (next: Block[], tag?: string | null) => void
  setSelection: (ids: readonly string[]) => void
}

// The context menu's and hotkeys' whole-selection mutators - clipboard, duplicate, remove,
// z-order, and hidden/locked toggling, every one committing in a single undo entry. Split out of
// useTemplateEditor.ts to keep that file under the repo's line budget; this stays exactly as much
// "the hook layer" as the file it was extracted from - a plain factory with no hook calls of its
// own, re-created every render from useTemplateEditor's current state and setters.
export function createSelectionActions({
  blocks,
  bounds,
  selectedIds,
  commitBlocks,
  setSelection
}: SelectionActionsContext) {
  const removeSelection = (ids: readonly string[]) => {
    if (ids.length === 0) return

    let next = blocks

    for (const id of ids) next = removeById(next, id)

    const idSet = new Set(ids)

    commitBlocks(next)
    setSelection(selectedIds.filter((id) => !idSet.has(id)))
  }

  // Duplicate generalized to the whole selection: each top-level member clones through the same
  // fresh-id-and-offset primitive as a single duplicate, folded into one commit. A selected id with
  // no top-level match contributes nothing, matching duplicateBlockOnCanvas's own silent no-op for
  // an unknown id.
  const duplicateSelection = () => {
    let next = blocks
    const newIds: string[] = []

    for (const id of selectedIds) {
      const insertion = duplicateBlockOnCanvas(next, id, bounds)

      if (!insertion.block) continue

      next = insertion.blocks
      newIds.push(insertion.block.id)
    }

    if (newIds.length === 0) return

    commitBlocks(next)
    setSelection(newIds)
  }

  const copySelection = () => {
    const payload = serializeSelection(blocks, selectedIds)

    if (payload) clipboardBuffer = payload
  }

  const hasClipboard = () => clipboardBuffer !== null

  // Plain paste offsets one grid cell from the copied source; "paste here" (anchor supplied by the
  // context menu's cursor point) places the copied set's bounding box top-left at the cursor
  // instead, preserving every member's relative offset.
  const pasteClipboard = (anchor?: Point) => {
    if (!clipboardBuffer) return

    const inserted = materializePastedBlocks(clipboardBuffer, bounds, anchor)

    if (inserted.length === 0) return

    commitBlocks([...blocks, ...inserted])
    setSelection(inserted.map((block) => block.id))
  }

  const copyStyle = (id: string) => {
    const target = findBlock(blocks, id)?.block

    if (!target) return

    styleClipboardBuffer = { style: extractStyle(target) }
  }

  const hasStyleClipboard = () => styleClipboardBuffer !== null

  // Paste style replaces every selected member's style sub-object outright (never merged) -
  // geometry and content stay untouched, one undo entry for the whole selection.
  const pasteStyle = () => {
    if (!styleClipboardBuffer) return

    const { style } = styleClipboardBuffer
    let next = blocks

    for (const id of selectedIds) {
      const target = findBlock(next, id)?.block

      if (!target) continue

      next = replaceById(next, applyStyleToBlock(target, style))
    }

    if (next === blocks) return

    commitBlocks(next)
  }

  // Z-order is sibling array order at whatever depth a block lives - moveSiblingOrder/
  // moveSiblingGroupToEdge are tree-aware, so a frame child reorders within its own frame exactly
  // like a top-level block reorders within the page. A step (forward/backward) applies to a single
  // selected block only - it has no well-defined meaning for an arbitrary multi-member set; an edge
  // (front/back) applies to the whole selection as one unit when every member shares the same
  // parent (moveSiblingGroupToEdge itself refuses a mixed-parent set).
  const commitSiblingStep = (direction: "forward" | "backward") => {
    const id = selectedIds.length === 1 ? selectedIds[0] : undefined

    if (id === undefined) return

    const next = moveSiblingOrder(blocks, id, direction)

    if (next) commitBlocks(next)
  }

  const commitSiblingEdge = (edge: "front" | "back") => {
    const next = moveSiblingGroupToEdge(blocks, selectedIds, edge)

    if (next) commitBlocks(next)
  }

  // The context menu's and the hotkey's whole-selection toggle: hidden/locked if any member isn't
  // yet, otherwise shown/unlocked - a standard multi-select toggle, one undo entry regardless of how
  // many members it touches.
  const toggleSelectionFlag = (flag: "hidden" | "locked") => {
    if (selectedIds.length === 0) return

    const nextValue = !selectedIds.every((id) => findBlock(blocks, id)?.block[flag] === true)
    let next = blocks

    for (const id of selectedIds) {
      const target = findBlock(next, id)?.block

      if (!target || target[flag] === nextValue) continue

      next = replaceById(next, { ...target, [flag]: nextValue })
    }

    if (next === blocks) return

    commitBlocks(next)
  }

  return {
    removeSelection,
    duplicateSelection,
    copySelection,
    hasClipboard,
    pasteClipboard,
    copyStyle,
    hasStyleClipboard,
    pasteStyle,
    bringSelectionForward: () => commitSiblingStep("forward"),
    sendSelectionBackward: () => commitSiblingStep("backward"),
    bringSelectionToFront: () => commitSiblingEdge("front"),
    sendSelectionToBack: () => commitSiblingEdge("back"),
    toggleHiddenSelection: () => toggleSelectionFlag("hidden"),
    toggleLockedSelection: () => toggleSelectionFlag("locked")
  }
}
