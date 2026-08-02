import {
  BLOCK_TYPES,
  FRAME_CHILD_TYPES,
  FRAME_MAX_DEPTH,
  GRID_SIZE,
  type AddableBlockType,
  type Block,
  type BlockType,
  type ShapeVariant
} from "../schemas"

import { findBlock } from "./blockTree"
import { clampRectToBounds, findFreePosition, type ContentBounds, type Size } from "./canvasLayout"

export type PropertyGroupKey = "spacing" | "appearance" | "typography"

// Which collapsible style sections each block type exposes. Adding one is a single entry here.
export const BLOCK_PROPERTY_GROUPS = {
  text: ["spacing", "appearance", "typography"],
  image: ["spacing", "appearance"],
  table: ["spacing", "appearance", "typography"],
  frame: ["spacing", "appearance"],
  // A group has no style of its own, so it exposes no property groups.
  group: [],
  shape: ["spacing", "appearance"]
} as const satisfies Record<BlockType, readonly PropertyGroupKey[]>

export type FrameChildType = (typeof FRAME_CHILD_TYPES)[number]

// Excludes group, which can only be created by grouping an existing selection.
export function getBlockPalette(): readonly AddableBlockType[] {
  return BLOCK_TYPES.filter((type): type is AddableBlockType => type !== "group")
}

export function getFrameChildPalette(depth: number): readonly FrameChildType[] {
  return depth < FRAME_MAX_DEPTH
    ? FRAME_CHILD_TYPES
    : FRAME_CHILD_TYPES.filter((type) => type !== "frame")
}

// A leaf is 0, a container of leaves is 1, one holding another container is 2. Mirrors the schema's
// write-path FRAME_MAX_DEPTH bound.
export function containerNestingDepth(block: Block): number {
  if (block.type !== "frame" && block.type !== "group") return 0

  return (
    1 +
    block.content.children.reduce(
      (deepest, child) => Math.max(deepest, containerNestingDepth(child)),
      0
    )
  )
}

// Includes every descendant, so read-path scans for uploads or token sources reach any depth.
export function flattenBlocks(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block) =>
    block.type === "frame" || block.type === "group"
      ? [block, ...flattenBlocks(block.content.children)]
      : [block]
  )
}

// Every block spawns at the minimum size its content needs, never full width. Exported for
// normalizeBlocks.ts, whose migrators fall back to these same defaults.
export const NATURAL_HEIGHTS: Record<AddableBlockType, number> = {
  text: 32,
  image: 160,
  table: 160,
  frame: 120,
  shape: 96
}

export const NATURAL_WIDTHS: Record<AddableBlockType, number> = {
  text: 240,
  image: 160,
  table: 480,
  frame: 480,
  shape: 160
}

export const CHILD_NATURAL_SIZES: Record<FrameChildType, Size> = {
  text: { width: 160, height: 32 },
  image: { width: 96, height: 96 },
  shape: { width: 120, height: 96 },
  frame: { width: 240, height: 96 }
}

function getNaturalSize(type: AddableBlockType): Size {
  return { width: NATURAL_WIDTHS[type], height: NATURAL_HEIGHTS[type] }
}

function createBlockContent(type: AddableBlockType): Block["content"] {
  switch (type) {
    case "text":
      return { html: "" }
    case "image":
      return { source: "upload", uploadId: null, alt: "" }
    case "table":
      return {
        source: "manual",
        columns: [
          { id: crypto.randomUUID(), header: "", width: null, binding: null },
          { id: crypto.randomUUID(), header: "", width: null, binding: null },
          { id: crypto.randomUUID(), header: "", width: null, binding: null }
        ],
        rows: [
          { id: crypto.randomUUID(), cells: ["", "", ""] },
          { id: crypto.randomUUID(), cells: ["", "", ""] }
        ]
      }
    case "frame":
      return { clip: false, children: [] }
    case "shape":
      return { variant: "rectangle" }
  }
}

export function createBlock(type: AddableBlockType, bounds: ContentBounds): Block {
  const size = getNaturalSize(type)

  return {
    id: crypto.randomUUID(),
    type,
    layout: clampRectToBounds({ x: 0, y: 0, ...size }, bounds),
    hidden: false,
    locked: false,
    content: createBlockContent(type)
  } as Block
}

// At the frame's content origin (0, 0), since frame children are absolutely positioned and the
// user drags them into place.
export function createFrameChild(type: FrameChildType): Block {
  const size = CHILD_NATURAL_SIZES[type]

  return {
    id: crypto.randomUUID(),
    type,
    layout: { x: 0, y: 0, ...size },
    hidden: false,
    locked: false,
    content: createBlockContent(type)
  } as Block
}

export type BlockInsertion = {
  blocks: Block[]
  block: Block | null
}

// The content-box origin, or directly below the lowest existing block.
export function addBlock(
  blocks: readonly Block[],
  type: AddableBlockType,
  bounds: ContentBounds
): BlockInsertion {
  const block = createBlock(type, bounds)

  const placed: Block = {
    ...block,
    layout: findFreePosition(blocks, block.layout, bounds)
  }

  return { blocks: [...blocks, placed], block: placed }
}

// The palette exposes each variant separately, so the shape carries the picked one rather than the
// `rectangle` default.
export function addShape(
  blocks: readonly Block[],
  variant: ShapeVariant,
  bounds: ContentBounds
): BlockInsertion {
  const base = createBlock("shape", bounds)
  const shape: Block = base.type === "shape" ? { ...base, content: { variant } } : base

  const placed: Block = {
    ...shape,
    layout: findFreePosition(blocks, shape.layout, bounds)
  }

  return { blocks: [...blocks, placed], block: placed }
}

// One grid cell down-right of its source and last among its siblings; overlap is legal, so no
// sweep is needed. A nested source clones into its own parent rather than being dropped, and stays
// unclamped by the page - only a top-level clone is clamped to `bounds`.
export function duplicateBlock(
  blocks: readonly Block[],
  id: string,
  bounds: ContentBounds
): BlockInsertion {
  const lookup = findBlock(blocks, id)

  if (!lookup) return { blocks: [...blocks], block: null }

  const clone = reassignIds(structuredClone(lookup.block))
  const offsetLayout = {
    ...lookup.block.layout,
    x: lookup.block.layout.x + GRID_SIZE,
    y: lookup.block.layout.y + GRID_SIZE
  }

  if (lookup.parent === null) {
    clone.layout = clampRectToBounds(offsetLayout, bounds)

    return { blocks: [...blocks, clone], block: clone }
  }

  clone.layout = offsetLayout

  return { blocks: insertBesideParent(blocks, lookup.parent.id, clone), block: clone }
}

// Beside its source, inside whatever container holds it, at whatever depth that parent lives.
function insertBesideParent(blocks: readonly Block[], parentId: string, clone: Block): Block[] {
  return blocks.map((block) => {
    if (block.type !== "frame" && block.type !== "group") return block

    if (block.id === parentId) {
      return {
        ...block,
        content: { ...block.content, children: [...block.content.children, clone] }
      } as Block
    }

    return {
      ...block,
      content: {
        ...block.content,
        children: insertBesideParent(block.content.children, parentId, clone)
      }
    } as Block
  })
}

// Re-ids a clone and everything under it, so a duplicate shares no id with its source. Exported so
// the clipboard's paste path reuses this rather than growing a second implementation.
export function reassignIds(block: Block): Block {
  block.id = crypto.randomUUID()

  if (block.type === "table") {
    block.content.columns = block.content.columns.map((column) => ({
      ...column,
      id: crypto.randomUUID()
    }))
    block.content.rows = block.content.rows.map((row) => ({ ...row, id: crypto.randomUUID() }))
  }

  if (block.type === "frame" || block.type === "group") {
    block.content.children = block.content.children.map((child) => reassignIds(child))
  }

  return block
}
