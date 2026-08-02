import { escapeHtml } from "@/lib/utils"

import {
  FRAME_MAX_DEPTH,
  GRID_SIZE,
  MIN_BLOCK_HEIGHT,
  MIN_BLOCK_WIDTH,
  storedBlockSchema,
  type Block,
  type BlockStyle,
  type BlockType,
  type FrameContent,
  type StoredBlock,
  type TemplatePageSettings,
  type TemplateType
} from "../schemas"

import { CHILD_NATURAL_SIZES, NATURAL_HEIGHTS, NATURAL_WIDTHS, type FrameChildType } from "./blocks"
import {
  clampRectToBounds,
  getContentBounds,
  quantizeToGrid,
  type ContentBounds,
  type Size
} from "./canvasLayout"
import { normalizeGroups } from "./groupBounds"
import { foldRotation } from "./rotateMath"

const LEGACY_COLUMN_GAP = 16
const LEGACY_ROW_GAP = GRID_SIZE

// The hairline fill a migrated divider (now a line shape) keeps so the rule stays visible.
const DIVIDER_LINE_COLOR = "#e2e8f0"

const HEADING_LEVEL_STYLES: Record<1 | 2 | 3, { fontSize: number; fontWeight: "600" | "700" }> = {
  1: { fontSize: 28, fontWeight: "700" },
  2: { fontSize: 22, fontWeight: "600" },
  3: { fontSize: 18, fontWeight: "600" }
}

type StoredGeneration = "absolute" | "flow" | "legacy"

// Normalizes stored rows of any generation into the free-canvas model with no user data loss:
// - Absolute rows (layout carries x/y) pass through quantized and clamped.
// - Constrained-flow rows ((row, column) layouts) stack vertically at a running y; side-by-side
//   rows keep their arrangement as x offsets, null widths sharing the content width equally.
// - Legacy freeform rows (frame) map near-directly.
// - Original list rows (no frame, no layout) stack vertically in array order.
// - heading rows become text rows, the level approximated as font-size/weight style.
// Every migrator clamps inside the content box. Overlap the sources carried is preserved, since
// overlap is legal in the layered model.
export function normalizeBlocks(
  stored: StoredBlock[],
  type: TemplateType,
  pageSettings: TemplatePageSettings
): Block[] {
  const bounds = getContentBounds(type, pageSettings)

  const generation = resolveGeneration(stored)

  const migrated =
    generation === "flow"
      ? migrateFlowBlocks(stored, bounds)
      : generation === "absolute"
        ? migrateAbsoluteBlocks(stored, bounds)
        : migrateLegacyBlocks(stored, bounds)

  return normalizeGroups(migrated)
}

function resolveGeneration(stored: StoredBlock[]): StoredGeneration {
  if (stored.length === 0) return "absolute"

  if (stored.every((block) => block.layout?.x !== undefined && block.layout?.y !== undefined)) {
    return "absolute"
  }

  if (stored.every((block) => block.layout !== undefined)) return "flow"

  return "legacy"
}

function migrateAbsoluteBlocks(stored: StoredBlock[], bounds: ContentBounds): Block[] {
  return stored.flatMap((block) => {
    const content = toModernContent(block)

    if (!content) return []

    // A group's natural size never applies - normalizeGroups re-derives it right after.
    const layout = clampRectToBounds(
      {
        x: quantizeToGrid(block.layout?.x ?? 0),
        y: quantizeToGrid(block.layout?.y ?? 0),
        width: quantizeToGrid(block.layout?.width ?? NATURAL_WIDTHS.text),
        height: quantizeToGrid(
          block.layout?.height ??
            (content.type === "group" ? NATURAL_HEIGHTS.frame : NATURAL_HEIGHTS[content.type])
        )
      },
      bounds
    )

    return [{ ...toModernBase(block), ...content, layout } as Block]
  })
}

function migrateFlowBlocks(stored: StoredBlock[], bounds: ContentBounds): Block[] {
  const ordered = stored.toSorted(
    (a, b) =>
      slotWeight(a) - slotWeight(b) ||
      (a.layout?.row ?? 0) - (b.layout?.row ?? 0) ||
      (a.layout?.column ?? 0) - (b.layout?.column ?? 0)
  )

  const rows: StoredBlock[][] = []

  for (const block of ordered) {
    const previous = rows[rows.length - 1]
    const previousFirst = previous?.[0]

    if (
      previousFirst &&
      slotWeight(previousFirst) === slotWeight(block) &&
      (previousFirst.layout?.row ?? 0) === (block.layout?.row ?? 0)
    ) {
      previous.push(block)
    } else {
      rows.push([block])
    }
  }

  const blocks: Block[] = []

  let y = 0

  for (const row of rows) {
    const members = row.flatMap((storedBlock) => {
      const content = toModernContent(storedBlock)

      return content
        ? [{ storedWidth: storedBlock.layout?.width ?? null, storedBlock, content }]
        : []
    })

    if (members.length === 0) continue

    const gaps = LEGACY_COLUMN_GAP * Math.max(members.length - 1, 0)
    const fixedTotal = members.reduce((total, member) => total + (member.storedWidth ?? 0), 0)
    const flexibleCount = members.filter((member) => member.storedWidth === null).length

    const flexibleWidth =
      flexibleCount > 0
        ? Math.max(
            Math.floor((bounds.width - gaps - fixedTotal) / flexibleCount / GRID_SIZE) * GRID_SIZE,
            GRID_SIZE
          )
        : 0

    let x = 0
    let rowHeight = 0

    for (const member of members) {
      const width = member.storedWidth ?? flexibleWidth
      const height = quantizeToGrid(
        member.storedBlock.layout?.height ??
          (member.content.type === "group"
            ? NATURAL_HEIGHTS.frame
            : NATURAL_HEIGHTS[member.content.type])
      )

      const layout = clampRectToBounds({ x, y, width: quantizeToGrid(width), height }, bounds)

      blocks.push({ ...toModernBase(member.storedBlock), ...member.content, layout } as Block)

      x = layout.x + layout.width + LEGACY_COLUMN_GAP
      rowHeight = Math.max(rowHeight, layout.height)
    }

    y += rowHeight + LEGACY_ROW_GAP
  }

  return blocks
}

function migrateLegacyBlocks(stored: StoredBlock[], bounds: ContentBounds): Block[] {
  const ordered = stored
    .map((block, index) => ({ block, index }))
    .toSorted((a, b) => {
      const aFrame = a.block.frame
      const bFrame = b.block.frame

      if (aFrame && bFrame) return aFrame.y - bFrame.y || aFrame.x - bFrame.x

      return a.index - b.index
    })

  const blocks: Block[] = []

  let stackY = 0

  for (const { block } of ordered) {
    const content = toModernContent(block)

    if (!content) continue

    const layout = block.frame
      ? clampRectToBounds(
          {
            x: quantizeToGrid(block.frame.x),
            y: quantizeToGrid(block.frame.y),
            width: quantizeToGrid(block.frame.width),
            height: quantizeToGrid(block.frame.height)
          },
          bounds
        )
      : clampRectToBounds(
          {
            x: 0,
            y: stackY,
            width: bounds.width,
            height: content.type === "group" ? NATURAL_HEIGHTS.frame : NATURAL_HEIGHTS[content.type]
          },
          bounds
        )

    if (!block.frame) stackY = layout.y + layout.height + LEGACY_ROW_GAP

    blocks.push({ ...toModernBase(block), ...content, layout } as Block)
  }

  return blocks
}

function slotWeight(block: StoredBlock): number {
  const slot = block.layout?.slot

  return slot === "header" ? 0 : slot === "footer" ? 2 : 1
}

function toModernBase(stored: StoredBlock) {
  return {
    id: stored.id,
    hidden: stored.hidden ?? false,
    locked: stored.locked ?? false,
    ...(stored.name ? { name: stored.name } : {}),
    ...(stored.constraints ? { constraints: stored.constraints } : {}),
    ...(stored.style ? { style: stored.style } : {}),
    // A group never carries rotation, so a stored one is dropped rather than leaked onto the
    // runtime block.
    ...(stored.rotation !== undefined && stored.type !== "group"
      ? { rotation: foldRotation(stored.rotation) }
      : {})
  }
}

type ModernContent = { type: BlockType; content: Block["content"]; style?: BlockStyle }

// Only the user-authored strings survive, mapped onto a text block: the primitive model has no home
// for the presentation toggles. Toggle-only types and content-free spacers drop entirely.
function toModernContent(stored: StoredBlock): (ModernContent & { type: Block["type"] }) | null {
  switch (stored.type) {
    case "heading":
      return headingToText(stored.content.text, stored.content.level, stored.style)
    case "text":
      return { type: "text", content: stored.content }
    case "image":
      return {
        type: "image",
        content: {
          source: stored.content.source ?? "upload",
          uploadId: stored.content.uploadId ?? null,
          alt: stored.content.alt ?? ""
        }
      }
    case "divider":
      // The thin rule survives as a filled bar, authored style kept over the hairline default.
      return {
        type: "shape",
        content: { variant: "line" },
        style: { backgroundColor: DIVIDER_LINE_COLOR, ...stored.style }
      }
    case "spacer":
      // Spacers hold size only, and free positioning replaces whitespace, so nothing is lost.
      return null
    case "shape":
      return { type: "shape", content: stored.content }
    case "table":
      return { type: "table", content: stored.content }
    case "frame":
      return { type: "frame", content: normalizeFrameContent(stored.content, 1) }
    case "group": {
      const children = normalizeContainerChildren(stored.content.children, 1)

      return children.length > 0 ? { type: "group", content: { children } } : null
    }
    case "box":
      return { type: "frame", content: boxToFrameContent(stored.content, 1) }
    case "header": {
      const text = stored.content.title?.trim() ?? ""

      if (!text) return null

      return headingToText(text, 1, stored.style)
    }
    case "footer":
    case "notes":
    case "terms": {
      const html = stored.content.text ?? ""

      if (!html.trim()) return null

      return { type: "text", content: { html } }
    }
    case "business_info":
    case "client_info":
    case "line_items":
    case "totals":
    case "payment_info":
    case "signature":
      return null
  }
}

// The string survives HTML-escaped, since heading text was plain, and the level approximates as
// size/weight underneath any explicitly authored style.
function headingToText(
  text: string,
  level: 1 | 2 | 3,
  style: BlockStyle | undefined
): ModernContent & { type: "text" } {
  return {
    type: "text",
    content: { html: escapeHtml(text) },
    style: { ...HEADING_LEVEL_STYLES[level], ...style }
  }
}

type StoredBoxContent = Extract<StoredBlock, { type: "box" }>["content"]
type StoredFrameContent = Extract<StoredBlock, { type: "frame" }>["content"]

// Anything unparseable drops rather than corrupting the parent. `depth` is the containing
// container's level, so a container child is admitted only while there is room beneath
// FRAME_MAX_DEPTH.
function normalizeStoredChild(candidate: unknown, depth: number): Block | null {
  const parsed = storedBlockSchema.safeParse(candidate)

  if (!parsed.success) return null

  const stored = parsed.data

  if (stored.type === "group") return normalizeStoredGroupChild(stored, depth)
  if (stored.type === "box" || stored.type === "frame") {
    return normalizeStoredContainerChild(stored, depth)
  }

  const modern = toModernContent(stored)

  if (!modern) return null

  const natural = CHILD_NATURAL_SIZES[modern.type as FrameChildType] ?? CHILD_NATURAL_SIZES.text

  return {
    ...toModernBase(stored),
    ...modern,
    layout: childLayout(stored, natural)
  } as Block
}

function normalizeStoredGroupChild(
  stored: Extract<StoredBlock, { type: "group" }>,
  depth: number
): Block | null {
  if (depth >= FRAME_MAX_DEPTH) return null

  const children = normalizeContainerChildren(stored.content.children, depth + 1)

  if (children.length === 0) return null

  return {
    id: stored.id,
    type: "group",
    layout: childLayout(stored, CHILD_NATURAL_SIZES.frame),
    hidden: stored.hidden ?? false,
    locked: stored.locked ?? false,
    ...(stored.name ? { name: stored.name } : {}),
    ...(stored.constraints ? { constraints: stored.constraints } : {}),
    content: { children }
  }
}

function normalizeStoredContainerChild(
  stored: Extract<StoredBlock, { type: "box" | "frame" }>,
  depth: number
): Block | null {
  if (depth >= FRAME_MAX_DEPTH) return null

  const content =
    stored.type === "box"
      ? boxToFrameContent(stored.content, depth + 1)
      : normalizeFrameContent(stored.content, depth + 1)

  return {
    id: stored.id,
    type: "frame",
    layout: childLayout(stored, CHILD_NATURAL_SIZES.frame),
    hidden: stored.hidden ?? false,
    locked: stored.locked ?? false,
    ...(stored.name ? { name: stored.name } : {}),
    ...(stored.constraints ? { constraints: stored.constraints } : {}),
    ...(stored.style ? { style: stored.style } : {}),
    ...(stored.rotation !== undefined ? { rotation: foldRotation(stored.rotation) } : {}),
    content
  }
}

// Left unclamped by the frame - clip handles any overflow.
function childLayout(stored: StoredBlock, natural: Size): Block["layout"] {
  return {
    x: quantizeToGrid(stored.layout?.x ?? 0),
    y: quantizeToGrid(stored.layout?.y ?? 0),
    width: Math.max(quantizeToGrid(stored.layout?.width ?? natural.width), MIN_BLOCK_WIDTH),
    height: Math.max(quantizeToGrid(stored.layout?.height ?? natural.height), MIN_BLOCK_HEIGHT)
  }
}

// `clip` defaults false when a legacy row omits it.
function normalizeFrameContent(content: StoredFrameContent, depth: number): FrameContent {
  return {
    clip: content.clip ?? false,
    children: normalizeContainerChildren(content.children, depth)
  }
}

function normalizeContainerChildren(children: readonly unknown[], depth: number): Block[] {
  return children.flatMap<Block>((candidate) => {
    const child = normalizeStoredChild(candidate, depth)

    return child ? [child] : []
  })
}

// A one-time conversion of a legacy box's flex arrangement to absolute children, laying them out
// along the box's prior direction at its gap. Only the exact pixel offsets are approximated;
// content and style are preserved.
function boxToFrameContent(content: StoredBoxContent, depth: number): FrameContent {
  const horizontal = content.direction === "row"
  const gap = quantizeToGrid(content.gap)

  let cursor = 0

  const children = content.children.flatMap<Block>((candidate) => {
    const child = normalizeStoredChild(candidate, depth)

    if (!child) return []

    const positioned: Block = {
      ...child,
      layout: {
        ...child.layout,
        x: horizontal ? cursor : 0,
        y: horizontal ? 0 : cursor
      }
    }

    cursor += (horizontal ? child.layout.width : child.layout.height) + gap

    return [positioned]
  })

  return { clip: false, children }
}
