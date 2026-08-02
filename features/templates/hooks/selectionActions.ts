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

// Module-level rather than React state, so a copy survives navigating away and back within the
// session: every editor instance in the tab shares one buffer, like a native OS clipboard.
let clipboardBuffer: Block[] | null = null
let styleClipboardBuffer: { style: BlockStyle | undefined } | null = null

type SelectionActionsContext = {
  blocks: Block[]
  bounds: ContentBounds
  selectedIds: string[]
  commitBlocks: (next: Block[], tag?: string | null) => void
  setSelection: (ids: readonly string[]) => void
}

// The whole-selection mutators, each committing in a single undo entry. A plain factory with no
// hook calls of its own, re-created every render from useTemplateEditor's current state and
// setters, split out only to keep that file under the repo's line budget.
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

  // Each member clones through the same primitive a single duplicate uses, folded into one commit.
  // A selected id with no top-level match contributes nothing, matching duplicateBlockOnCanvas.
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

  // With an anchor ("paste here"), the copied set's bounding box top-left lands at the cursor,
  // preserving every member's relative offset; without one it offsets a grid cell from the source.
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

  // Replaces each member's style outright rather than merging; geometry and content stay
  // untouched.
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

  // Z-order is sibling array order at whatever depth a block lives, so a frame child reorders
  // within its frame exactly as a top-level block does within the page. A step applies to a single
  // block only, having no meaning for an arbitrary set; an edge applies to the whole selection when
  // every member shares a parent, which moveSiblingGroupToEdge itself enforces.
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

  // Standard multi-select toggle: hidden/locked if any member is not yet, otherwise shown.
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
