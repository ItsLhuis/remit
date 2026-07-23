"use client"

import { useCallback, useMemo, useRef, useState } from "react"

import {
  BLOCK_CAPABILITIES,
  GRID_SIZE,
  type AddableBlockType,
  type Block,
  type BlockCapability,
  type BlockConstraints,
  type BlockStyle,
  type ShapeVariant,
  type TemplatePageSettings,
  type TemplateType
} from "../schemas"
import {
  addBlock as addBlockToCanvas,
  addShape as addShapeToCanvas,
  buildIndex,
  clampMoveRect,
  createFrameChild,
  deriveContainerRebase,
  findBlock,
  getContentBounds,
  normalizeGroups,
  reflowToBounds,
  removeById,
  reparentBlock as reparentBlockInTree,
  replaceById,
  resolveBlocksRotationTo,
  resolveMovedBlocks,
  resolveResizedBlocks,
  resolveRotatedBlocks,
  spliceById,
  stripName,
  stripStyle,
  type ContainerRebase,
  type FrameChildType,
  type Point,
  type Rect,
  type ResizeEdges
} from "../services"

import { createSelectionActions } from "./selectionActions"

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

const ZOOM_MIN = 0.25
const ZOOM_MAX = 2
const HISTORY_LIMIT = 50

type EditorDocument = {
  blocks: Block[]
  pageSettings: TemplatePageSettings
}

// Every stored coordinate and size moves in whole grid cells (GRID_SIZE) only - no pixel-level
// path, no snap toggle. Move commits displace overlapped neighbours downward; resize commits
// hard-clamp at the page bounds and neighbour edges. Both run through the pure canvas geometry so
// overlap and out-of-bounds are impossible to commit.
export function useTemplateEditor(
  initialBlocks: Block[],
  type: TemplateType,
  initialPageSettings: TemplatePageSettings,
  initialAssets: Record<string, string> = {}
) {
  const [document, setDocument] = useState<EditorDocument>(() => ({
    blocks: initialBlocks,
    pageSettings: initialPageSettings
  }))
  // Ordered so the last entry is the most recently added member — the layers panel's Shift-range
  // anchor. A single-selection UI (the property panel, the status bar) reads selectedBlockId, which
  // is null while zero or several ids are selected.
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [assets, setAssets] = useState<Record<string, string>>(initialAssets)
  const [zoom, setZoomValue] = useState(1)
  const [past, setPast] = useState<EditorDocument[]>([])
  const [future, setFuture] = useState<EditorDocument[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({ blocks: initialBlocks, pageSettings: initialPageSettings })
  )

  // Consecutive edits sharing a tag (typing in one field, arrow-key nudging one block) coalesce
  // into a single history entry so undo steps stay meaningful.
  const lastCommitTagRef = useRef<string | null>(null)

  const { blocks, pageSettings } = document

  const bounds = useMemo(() => getContentBounds(type, pageSettings), [type, pageSettings])

  // The normalized runtime index: rebuilt once per document commit; every
  // hit-test, selection, and gesture computation reads it instead of re-walking the tree.
  const blockIndex = useMemo(() => buildIndex(blocks), [blocks])

  const selectedBlockId = selectedIds.length === 1 ? (selectedIds[0] ?? null) : null
  const selected = findBlock(blocks, selectedBlockId)
  const selectedBlock = selected?.block ?? null

  // Stable identities (unlike every other returned method here): consumers such as the property
  // panel's "select the first block on mount" effect list selectBlock in a useEffect dependency
  // array, matching its pre-multi-select identity of the useState setter directly. A recreated
  // function there would re-run the effect every render and loop.
  const selectBlock = useCallback(
    (id: string | null) => setSelectedIds(id === null ? [] : [id]),
    []
  )

  const setSelection = useCallback(
    (ids: readonly string[]) => setSelectedIds([...new Set(ids)]),
    []
  )

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]
    )
  }, [])

  const isDirty = useMemo(
    () => JSON.stringify(document) !== savedSnapshot,
    [document, savedSnapshot]
  )

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  // Every geometry commit re-derives every group's layout as the bounding union of its (possibly
  // just-edited) children - the single choke point so a group's box never drifts from its members,
  // whichever mutator produced the next tree. Reference-stable when nothing changed, so this is a
  // no-op for the overwhelmingly common document with no group.
  const commit = (next: EditorDocument, tag: string | null = null) => {
    const coalesce = tag !== null && tag === lastCommitTagRef.current

    if (!coalesce) setPast((previous) => [...previous.slice(-(HISTORY_LIMIT - 1)), document])

    lastCommitTagRef.current = tag
    setFuture([])
    setDocument({ ...next, blocks: normalizeGroups(next.blocks) })
  }

  const commitBlocks = (nextBlocks: Block[], tag: string | null = null) => {
    commit({ ...document, blocks: nextBlocks }, tag)
  }

  const undo = () => {
    const previous = past[past.length - 1]

    if (!previous) return

    setPast((entries) => entries.slice(0, -1))
    setFuture((entries) => [...entries, document])
    lastCommitTagRef.current = null
    setDocument(previous)
  }

  const redo = () => {
    const next = future[future.length - 1]

    if (!next) return

    setFuture((entries) => entries.slice(0, -1))
    setPast((entries) => [...entries, document])
    lastCommitTagRef.current = null
    setDocument(next)
  }

  const addBlock = (blockType: AddableBlockType) => {
    const insertion = addBlockToCanvas(blocks, blockType, bounds)

    if (!insertion.block) return

    commitBlocks(insertion.blocks)
    selectBlock(insertion.block.id)
  }

  const addShape = (variant: ShapeVariant) => {
    const insertion = addShapeToCanvas(blocks, variant, bounds)

    if (!insertion.block) return

    commitBlocks(insertion.blocks)
    selectBlock(insertion.block.id)
  }

  const removeBlock = (id: string) => {
    commitBlocks(removeById(blocks, id))
    setSelectedIds((current) => current.filter((existing) => existing !== id))
  }

  // Clipboard, duplicate-selection, remove-selection, z-order, and hidden/locked-toggle mutators:
  // see selectionActions.ts. Recreated every render from the current blocks/bounds/selectedIds, the
  // same way every other mutator here closes over them.
  const selectionActions = createSelectionActions({
    blocks,
    bounds,
    selectedIds,
    commitBlocks,
    setSelection
  })

  const replaceBlock = (block: Block, coalesceTag: string | null = null) => {
    commitBlocks(replaceById(blocks, block), coalesceTag)
  }

  // The inline-editor and panel-textarea commit primitive: html arrives already sanitized to the
  // authored profile by the caller, so this is a plain content write - never a second, less-strict
  // write path. Defaults to one undo entry per block, matching setBlocksStyle's tag convention.
  const setTextContent = (id: string, html: string, tag: string | null = `text:${id}`) => {
    const target = findBlock(blocks, id)?.block

    if (target?.type !== "text") return
    if (target.content.html === html) return

    replaceBlock({ ...target, content: { html } }, tag)
  }

  // The property panel's style write path, single- and multi-selection alike: each edit carries
  // the member's fully resolved next style (undefined strips the field), and the whole map lands
  // as one history entry so a multi-selection commit undoes in one step.
  const setBlocksStyle = (edits: ReadonlyMap<string, BlockStyle | undefined>) => {
    let next = blocks

    for (const [id, style] of edits) {
      const target = findBlock(next, id)?.block

      if (!target || target.locked || target.type === "group") continue

      next = replaceById(
        next,
        style === undefined || Object.keys(style).length === 0
          ? stripStyle(target)
          : { ...target, style }
      )
    }

    if (next === blocks) return

    commitBlocks(next, `style:${[...edits.keys()].join("+")}`)
  }

  // Committing a move: the block takes its desired rectangle, clamped into the content box. Overlap
  // is legal in the layered model, so no neighbour is displaced. Box children have no canvas
  // position; their moves are reorders handled by moveBoxChild.
  const moveBlockTo = (id: string, x: number, y: number, tag: string | null = null) => {
    const lookup = findBlock(blocks, id)

    if (!lookup || lookup.parent || lookup.block.locked) return

    const rect = clampMoveRect(lookup.block.layout, x, y, bounds)

    commitBlocks(replaceById(blocks, { ...lookup.block, layout: rect }), tag)
  }

  // Returns false when the drop is not a legal reparent, so the caller can fall back to a plain move.
  const reparentBlock = (
    ids: readonly string[],
    targetFrameId: string | null,
    droppedRects?: ReadonlyMap<string, Rect>
  ): boolean => {
    if (ids.length === 0) return false
    if (ids.some((id) => findBlock(blocks, id)?.block.locked)) return false

    const result = reparentBlockInTree({
      blocks,
      draggedIds: ids,
      targetFrameId,
      bounds,
      droppedRects
    })

    if (!result) return false

    commitBlocks(result.blocks)
    setSelection(ids)

    return true
  }

  // Moves a set of blocks by a page-space delta in one history entry (the pointer engine's commit
  // path and every keyboard nudge). The union clamp and per-member floor math is
  // services/moveMath.ts's resolveMovedBlocks (pure, no React), which returns null for a no-op move
  // so no meaningless undo entry is pushed.
  const moveBlocks = (ids: readonly string[], delta: Point, tag: string | null = null) => {
    const nextBlocks = resolveMovedBlocks(blockIndex, bounds, ids, delta)

    if (!nextBlocks) return

    commitBlocks(nextBlocks, tag)
  }

  const moveBlockBy = (id: string, dxCells: number, dyCells: number) => {
    moveBlocks([id], { x: dxCells * GRID_SIZE, y: dyCells * GRID_SIZE }, `move:${id}`)
  }

  // The shared resize commit primitive: the handle gesture and the panel's width/height fields
  // both resolve a next reference rect and commit through this one path. The actual set-scale and
  // frame-constraint math is services/constraints.ts's resolveResizedBlocks (pure, no React), kept
  // out of this hook so only the commit itself lives here.
  const resizeBlocks = (
    targets: readonly string[],
    nextReference: Rect,
    tag: string | null = null
  ) => {
    const nextBlocks = resolveResizedBlocks(blockIndex, bounds, targets, nextReference)

    if (!nextBlocks) return

    commitBlocks(nextBlocks, tag)
  }

  // Committing a resize from the property panel: the capability table gates which axes each type
  // resizes, then the gated rect (page-space for a top-level block, local-to-parent for a frame
  // child) commits through the same resizeBlocks primitive the handle gesture uses.
  const resizeBlockTo = (id: string, desired: Rect, edges: ResizeEdges) => {
    const lookup = findBlock(blocks, id)

    if (!lookup || lookup.block.locked) return

    const capability: BlockCapability = BLOCK_CAPABILITIES[lookup.block.type]
    const axes = capability.resizableAxes

    if (axes === "none") return

    const gatedEdges: ResizeEdges = {
      ...(axes !== "height" ? { horizontal: edges.horizontal } : {}),
      ...(axes !== "width" ? { vertical: edges.vertical } : {})
    }

    // A gated-off axis keeps the block's current geometry, so a width-only type can never commit a
    // height change (and vice versa).
    const gatedRect: Rect = {
      ...lookup.block.layout,
      ...(gatedEdges.horizontal ? { x: desired.x, width: desired.width } : {}),
      ...(gatedEdges.vertical ? { y: desired.y, height: desired.height } : {})
    }

    const entry = blockIndex.get(id)

    if (!entry) return

    const parentRect =
      entry.parentId === null ? null : (blockIndex.get(entry.parentId)?.pageRect ?? null)
    const pageRect: Rect = parentRect
      ? { ...gatedRect, x: parentRect.x + gatedRect.x, y: parentRect.y + gatedRect.y }
      : gatedRect

    resizeBlocks([id], pageRect, `resize:${id}`)
  }

  // The rotate gesture's commit primitive: a shared-center delta applied to the targets' member
  // set, one history entry. The set math is services/rotateMath.ts's resolveRotatedBlocks (pure,
  // no React) — the same rotateSetBy the live preview runs, so the preview is the commit.
  const rotateBlocks = (targets: readonly string[], degrees: number, tag: string | null = null) => {
    const nextBlocks = resolveRotatedBlocks(blockIndex, bounds, targets, degrees)

    if (!nextBlocks) return

    commitBlocks(nextBlocks, tag)
  }

  // The panel's rotation field: one absolute value applied about each member's own center.
  const rotateBlocksTo = (
    targets: readonly string[],
    degrees: number,
    tag: string | null = null
  ) => {
    const nextBlocks = resolveBlocksRotationTo(blockIndex, bounds, targets, degrees)

    if (!nextBlocks) return

    commitBlocks(nextBlocks, tag)
  }

  const resizeBlockBy = (id: string, dwCells: number, dhCells: number) => {
    const lookup = findBlock(blocks, id)

    if (!lookup) return

    const { layout } = lookup.block

    resizeBlockTo(
      id,
      {
        ...layout,
        width: layout.width + dwCells * GRID_SIZE,
        height: layout.height + dhCells * GRID_SIZE
      },
      { horizontal: "e", vertical: "s" }
    )
  }

  // Shared by groupSelection and wrapInFrame: both wrap the same selected top-level blocks, in the
  // same parent-local coordinate space, through the same union-and-rebase math
  // (services/groupBounds.ts's deriveContainerRebase) - the only difference is the container the
  // caller builds around the result, so the two entry points produce identical child geometry from
  // an identical selection.
  const wrapSelectionInContainer = (build: (rebase: ContainerRebase) => Block): string | null => {
    const ids = selectedIds
    const idSet = new Set(ids)

    if (ids.length === 0) return null
    if (
      ids.some((id) => {
        const lookup = findBlock(blocks, id)

        return lookup?.parent !== null || lookup.block.locked
      })
    ) {
      return null
    }

    const selectedBlocks = blocks.filter((block) => idSet.has(block.id))
    const rebase = deriveContainerRebase(selectedBlocks)

    if (!rebase) return null

    const container = build(rebase)

    let inserted = false
    const nextBlocks = blocks.flatMap((block) => {
      if (!idSet.has(block.id)) return [block]
      if (inserted) return []

      inserted = true

      return [container]
    })

    commitBlocks(nextBlocks)
    selectBlock(container.id)

    return container.id
  }

  // Wraps the selected top-level blocks in a new group, replacing the selection with it. A group
  // has no independently authored size or style; its layout is the union deriveContainerRebase
  // just computed, re-derived on every later commit by normalizeGroups. Returns the new group's id
  // (or null on a refused/empty selection) so a keyboard or context-menu caller can move focus onto
  // it after the old top-level blocks unmount.
  const groupSelection = (): string | null => {
    return wrapSelectionInContainer((rebase) => ({
      id: crypto.randomUUID(),
      type: "group",
      layout: rebase.layout,
      hidden: false,
      locked: false,
      content: { children: rebase.children }
    }))
  }

  // Wraps the selected top-level blocks in a new frame, replacing the selection with it. Unlike a
  // group, a frame has an authored box and style, and unclipped by default so nothing already
  // visible disappears on wrap. Returns the new frame's id for the same focus-follow reason as
  // groupSelection.
  const wrapInFrame = (): string | null => {
    return wrapSelectionInContainer((rebase) => ({
      id: crypto.randomUUID(),
      type: "frame",
      layout: rebase.layout,
      hidden: false,
      locked: false,
      content: { clip: false, children: rebase.children }
    }))
  }

  // Dissolves a group, splicing its children back into whatever held the group (the top level or a
  // parent container) at the group's own position, converted out of the group's local coordinate
  // space back into that same space's absolute-to-the-group-origin coordinates. Selection becomes
  // the freed children. Returns their ids (or null on a refused/no-op call) so a caller can move
  // focus onto the freed selection once the dissolved group unmounts.
  const ungroup = (id: string): string[] | null => {
    const lookup = findBlock(blocks, id)

    if (lookup?.block.type !== "group" || lookup.block.locked) return null

    const origin = lookup.block.layout

    const freedChildren = lookup.block.content.children.map((child) => ({
      ...child,
      layout: { ...child.layout, x: child.layout.x + origin.x, y: child.layout.y + origin.y }
    }))

    commitBlocks(spliceById(blocks, id, freedChildren))

    const freedIds = freedChildren.map((child) => child.id)

    setSelection(freedIds)

    return freedIds
  }

  // Sets one block's per-axis layout constraints, read by applyFrameResize when its parent frame
  // resizes; meaningless (ignored) everywhere else. One undo step.
  const setConstraints = (id: string, constraints: BlockConstraints) => {
    const target = findBlock(blocks, id)?.block

    if (!target || target.locked) return
    if (
      target.constraints?.horizontal === constraints.horizontal &&
      target.constraints.vertical === constraints.vertical
    ) {
      return
    }

    replaceBlock({ ...target, constraints })
  }

  const addFrameChild = (frameId: string, childType: FrameChildType) => {
    const lookup = findBlock(blocks, frameId)

    if (lookup?.block.type !== "frame") return

    const child = createFrameChild(childType)

    replaceBlock({
      ...lookup.block,
      content: { ...lookup.block.content, children: [...lookup.block.content.children, child] }
    })
    selectBlock(child.id)
  }

  const moveFrameChild = (childId: string, offset: -1 | 1) => {
    const lookup = findBlock(blocks, childId)

    if (!lookup?.parent) return

    const children = [...lookup.parent.content.children]
    const index = children.findIndex((child) => child.id === childId)
    const target = index + offset

    if (index < 0 || target < 0 || target >= children.length) return

    const [moved] = children.splice(index, 1)

    if (!moved) return

    children.splice(target, 0, moved)

    const { parent } = lookup

    replaceBlock(
      parent.type === "frame"
        ? { ...parent, content: { ...parent.content, children } }
        : { ...parent, content: { children } }
    )
  }

  const renameBlock = (id: string, name: string) => {
    const target = findBlock(blocks, id)?.block

    if (!target) return

    const trimmed = name.trim()

    replaceBlock(trimmed ? { ...target, name: trimmed } : stripName(target))
  }

  // Reorders a block among its current siblings (top-level array, or a frame's children) to the
  // given storage index — array order is z-order, so this is the layers panel's drag-reorder
  // primitive. Moving between different parents is a reparent, not a reorder.
  const reorderSibling = (id: string, targetIndex: number) => {
    const lookup = findBlock(blocks, id)

    if (!lookup || lookup.block.locked) return

    if (!lookup.parent) {
      const index = blocks.findIndex((block) => block.id === id)

      if (index < 0) return

      const next = [...blocks]
      const [moved] = next.splice(index, 1)

      if (!moved) return

      next.splice(Math.min(Math.max(targetIndex, 0), next.length), 0, moved)
      commitBlocks(next)

      return
    }

    const children = [...lookup.parent.content.children]
    const index = children.findIndex((child) => child.id === id)

    if (index < 0) return

    const [moved] = children.splice(index, 1)

    if (!moved) return

    children.splice(Math.min(Math.max(targetIndex, 0), children.length), 0, moved)

    const { parent } = lookup

    replaceBlock(
      parent.type === "frame"
        ? { ...parent, content: { ...parent.content, children } }
        : { ...parent, content: { children } }
    )
  }

  const toggleHidden = (id: string) => {
    const target = findBlock(blocks, id)?.block

    if (!target) return

    replaceBlock({ ...target, hidden: !target.hidden })
  }

  const toggleLocked = (id: string) => {
    const target = findBlock(blocks, id)?.block

    if (!target) return

    replaceBlock({ ...target, locked: !target.locked })
  }

  const setPageSettings = (next: TemplatePageSettings) => {
    commit(
      { blocks: reflowToBounds(blocks, getContentBounds(type, next)), pageSettings: next },
      "pageSettings"
    )
  }

  const setZoom = (value: number) => {
    setZoomValue(Math.min(Math.max(value, ZOOM_MIN), ZOOM_MAX))
  }

  const zoomIn = () => {
    setZoomValue((current) => ZOOM_LEVELS.find((level) => level > current) ?? ZOOM_MAX)
  }

  const zoomOut = () => {
    setZoomValue(
      (current) => [...ZOOM_LEVELS].reverse().find((level) => level < current) ?? ZOOM_MIN
    )
  }

  const registerAsset = (uploadId: string, storageKey: string) => {
    setAssets((previous) => ({ ...previous, [uploadId]: storageKey }))
  }

  const markSaved = () => {
    setSavedSnapshot(JSON.stringify(document))
  }

  // Text is resizable on both axes; this only raises a text block's height to the content floor so
  // it never clips, and never shrinks below the height the user set. Floor syncs bypass the undo
  // history: they re-derive after any undo/redo anyway, and recording them would create undo steps
  // that instantly re-apply themselves. While the document is otherwise pristine, the saved snapshot
  // re-baselines so a legacy template whose stored height is below its measured floor does not open
  // dirty.
  const syncBlockMinHeight = (id: string, minHeight: number) => {
    const lookup = findBlock(blocks, id)

    if (!lookup || lookup.block.layout.height >= minHeight) return

    const pristine = !isDirty && past.length === 0 && future.length === 0

    const nextBlocks = normalizeGroups(
      replaceById(blocks, {
        ...lookup.block,
        layout: { ...lookup.block.layout, height: minHeight }
      })
    )

    const next = { ...document, blocks: nextBlocks }

    setDocument(next)

    if (pristine) setSavedSnapshot(JSON.stringify(next))
  }

  return {
    blocks,
    blockIndex,
    pageSettings,
    bounds,
    selectedIds,
    selectedBlockId,
    selectedBlock,
    selectedParent: selected?.parent ?? null,
    assets,
    zoom,
    isDirty,
    canUndo,
    canRedo,
    selectBlock,
    setSelection,
    toggleSelection,
    addBlock,
    addShape,
    removeBlock,
    ...selectionActions,
    replaceBlock,
    setTextContent,
    renameBlock,
    setBlocksStyle,
    moveBlockTo,
    moveBlocks,
    moveBlockBy,
    reparentBlock,
    reorderSibling,
    resizeBlocks,
    resizeBlockTo,
    resizeBlockBy,
    rotateBlocks,
    rotateBlocksTo,
    syncBlockMinHeight,
    groupSelection,
    wrapInFrame,
    ungroup,
    setConstraints,
    addFrameChild,
    moveFrameChild,
    toggleHidden,
    toggleLocked,
    setPageSettings,
    setZoom,
    zoomIn,
    zoomOut,
    undo,
    redo,
    registerAsset,
    markSaved
  }
}

export type TemplateEditorState = ReturnType<typeof useTemplateEditor>
