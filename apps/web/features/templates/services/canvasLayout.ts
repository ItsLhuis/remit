import {
  CANVAS_MAX_HEIGHT,
  GRID_SIZE,
  MIN_BLOCK_HEIGHT,
  MIN_BLOCK_WIDTH,
  type Block,
  type BlockLayout,
  type StoredPageSettings,
  type TemplatePageSettings,
  type TemplateType
} from "../schemas"

import { rotatedAabb } from "./geometry"
import { getTemplateCategory, supportsLineItems } from "./templateCategories"

// All free-canvas geometry, so components never inline positioning logic. Blocks may overlap
// freely (the model is layered, z-order is array order), leaving staying in bounds as the one hard
// invariant. Units are CSS pixels in page space: documents at A4 print width (794px @96dpi), emails
// at an email-safe 600px, the page growing downward with content.

export const DOCUMENT_PAGE_WIDTH = 794
export const DOCUMENT_MIN_PAGE_HEIGHT = 1123
export const EMAIL_PAGE_WIDTH = 600
export const EMAIL_MIN_PAGE_HEIGHT = 480

export const DEFAULT_PAGE_SETTINGS: TemplatePageSettings = {
  margins: { top: 32, right: 32, bottom: 32, left: 32 },
  fontFamily: "sans",
  baseFontSize: 14
}

export type Rect = BlockLayout

export type Size = {
  width: number
  height: number
}

// Vertical margins apply outside this box, so only the horizontal ones narrow it.
export type ContentBounds = Size

export type ResizeEdges = {
  horizontal?: "e" | "w"
  vertical?: "n" | "s"
}

export type ResizeLimit = {
  at: number
  kind: "page" | "block"
}

export type ResizeLimits = {
  left?: ResizeLimit
  right?: ResizeLimit
  top?: ResizeLimit
  bottom?: ResizeLimit
}

export type ResolvedResize = {
  rect: Rect
  limits: ResizeLimits
}

export type CanvasValidation = { valid: true } | { valid: false; reason: CanvasValidationReason }

export type CanvasValidationReason = "overlap" | "outOfBounds" | "collectionUnavailable"

export function getPageWidth(type: TemplateType): number {
  return getTemplateCategory(type) === "email" ? EMAIL_PAGE_WIDTH : DOCUMENT_PAGE_WIDTH
}

export function getMinPageHeight(type: TemplateType): number {
  return getTemplateCategory(type) === "email" ? EMAIL_MIN_PAGE_HEIGHT : DOCUMENT_MIN_PAGE_HEIGHT
}

export function getContentBounds(
  type: TemplateType,
  pageSettings: TemplatePageSettings
): ContentBounds {
  const width = getPageWidth(type) - pageSettings.margins.left - pageSettings.margins.right

  return { width: Math.floor(width / GRID_SIZE) * GRID_SIZE, height: CANVAS_MAX_HEIGHT }
}

// The canvas and the renderer both size the page through this, which is what makes the preview
// pixel-identical to the canvas.
export function getPageHeight(
  blocks: readonly Block[],
  type: TemplateType,
  pageSettings: TemplatePageSettings
): number {
  const contentBottom = blocks
    .filter((block) => !block.hidden)
    .reduce((bottom, block) => Math.max(bottom, block.layout.y + block.layout.height), 0)

  return Math.max(
    getMinPageHeight(type),
    pageSettings.margins.top + contentBottom + pageSettings.margins.bottom
  )
}

export function normalizePageSettings(
  stored: StoredPageSettings | null | undefined
): TemplatePageSettings {
  return {
    margins: stored?.margins ?? DEFAULT_PAGE_SETTINGS.margins,
    fontFamily: stored?.fontFamily ?? DEFAULT_PAGE_SETTINGS.fontFamily,
    baseFontSize: stored?.baseFontSize ?? DEFAULT_PAGE_SETTINGS.baseFontSize
  }
}

export function quantizeToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE || 0
}

// The smallest whole-cell height that fully contains the rendered text at its current width. Text
// is freely resizable, but its stored height is raised to this floor so content never clips.
export function contentMinHeight(measured: number): number {
  return Math.max(Math.ceil(measured / GRID_SIZE) * GRID_SIZE, MIN_BLOCK_HEIGHT)
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

export function clampRectToBounds(rect: Rect, bounds: ContentBounds): Rect {
  const width = Math.min(Math.max(quantizeToGrid(rect.width), MIN_BLOCK_WIDTH), bounds.width)
  const height = Math.min(Math.max(quantizeToGrid(rect.height), MIN_BLOCK_HEIGHT), bounds.height)

  const x = Math.min(Math.max(quantizeToGrid(rect.x), 0), bounds.width - width)
  const y = Math.min(Math.max(quantizeToGrid(rect.y), 0), bounds.height - height)

  return { x, y, width, height }
}

// Unlike clampRectToBounds, never re-quantizes x/y: snapping is applied upstream by the drag
// modifier and skipped under Alt, so quantizing here would undo an intentional off-grid placement.
export function clampMoveRect(layout: Rect, x: number, y: number, bounds: ContentBounds): Rect {
  const clampedX = Math.min(Math.max(Math.round(x), 0), bounds.width - layout.width)
  const clampedY = Math.min(Math.max(Math.round(y), 0), bounds.height - layout.height)

  return { ...layout, x: clampedX, y: clampedY }
}

export type ResizeClampLimits = {
  left?: number
  right?: number
  top?: number
  bottom?: number
}

// The resize flavour: shrinks rather than translating, so the anchored side never moves - unlike
// clampRectToBounds, which preserves size and is correct only for a move. Non-quantizing on
// purpose, since set scaling must not re-impose grid multiples on scaled sizes.
export function clampResizeRectToBounds(
  rect: Rect,
  bounds: ContentBounds
): { rect: Rect; limits: ResizeClampLimits } {
  const limits: ResizeClampLimits = {}

  let left = rect.x
  let top = rect.y
  let right = rect.x + rect.width
  let bottom = rect.y + rect.height

  if (left < 0) {
    left = 0
    limits.left = 0
  }

  if (top < 0) {
    top = 0
    limits.top = 0
  }

  if (right > bounds.width) {
    right = bounds.width
    limits.right = bounds.width
  }

  if (bottom > bounds.height) {
    bottom = bounds.height
    limits.bottom = bounds.height
  }

  return {
    rect: {
      x: left,
      y: top,
      width: Math.max(right - left, MIN_BLOCK_WIDTH),
      height: Math.max(bottom - top, MIN_BLOCK_HEIGHT)
    },
    limits
  }
}

// Overlap is legal, so the clamp is the whole reflow: z-order and the user's chosen positions are
// preserved, and only out-of-bounds rectangles move.
export function reflowToBounds(blocks: readonly Block[], bounds: ContentBounds): Block[] {
  return blocks.map((block) => {
    const clamped = clampRectToBounds(block.layout, bounds)

    return rectsEqual(clamped, block.layout) ? block : { ...block, layout: clamped }
  })
}

// Hidden blocks count toward the lowest edge - they keep their rectangles.
export function findFreePosition(
  blocks: readonly Block[],
  size: Size,
  bounds: ContentBounds
): Rect {
  const bottom = blocks.reduce(
    (lowest, block) => Math.max(lowest, block.layout.y + block.layout.height),
    0
  )

  const y = bottom === 0 ? 0 : bottom + GRID_SIZE

  return clampRectToBounds({ x: 0, y, width: size.width, height: size.height }, bounds)
}

// Reports each limit actually hit, so the canvas can draw its guide line.
export function resolveResize(
  blocks: readonly Block[],
  bounds: ContentBounds,
  id: string,
  input: { rect: Rect; edges: ResizeEdges }
): ResolvedResize {
  const current = blocks.find((block) => block.id === id)

  if (!current) return { rect: input.rect, limits: {} }

  const original = current.layout
  // Overlap is legal, so a resize ignores other blocks and clamps to the page bounds alone.
  const neighbours: Rect[] = []

  const limits: ResizeLimits = {}

  let { x, y, width, height } = {
    x: quantizeToGrid(input.rect.x),
    y: quantizeToGrid(input.rect.y),
    width: Math.max(quantizeToGrid(input.rect.width), MIN_BLOCK_WIDTH),
    height: Math.max(quantizeToGrid(input.rect.height), MIN_BLOCK_HEIGHT)
  }

  // The vertical axis clamps against the block's original horizontal span, then the horizontal
  // axis clamps against the already-clamped vertical span, which keeps corner drags deterministic.
  const verticalAxis: ResizeAxisInput = {
    neighbours: neighbours.map((rect) => ({
      mainStart: rect.y,
      mainEnd: rect.y + rect.height,
      crossStart: rect.x,
      crossEnd: rect.x + rect.width
    })),
    crossSpan: { start: original.x, end: original.x + original.width },
    originalStart: original.y,
    originalEnd: original.y + original.height,
    boundEnd: bounds.height
  }

  if (input.edges.vertical === "s") {
    const clamped = clampTrailingEdge(verticalAxis, y, height, MIN_BLOCK_HEIGHT)

    height = clamped.size

    if (clamped.limit) limits.bottom = clamped.limit
  }

  if (input.edges.vertical === "n") {
    const clamped = clampLeadingEdge(verticalAxis, y, MIN_BLOCK_HEIGHT)

    y = clamped.start
    height = clamped.size

    if (clamped.limit) limits.top = clamped.limit
  }

  const horizontalAxis: ResizeAxisInput = {
    neighbours: neighbours.map((rect) => ({
      mainStart: rect.x,
      mainEnd: rect.x + rect.width,
      crossStart: rect.y,
      crossEnd: rect.y + rect.height
    })),
    crossSpan: { start: y, end: y + height },
    originalStart: original.x,
    originalEnd: original.x + original.width,
    boundEnd: bounds.width
  }

  if (input.edges.horizontal === "e") {
    const clamped = clampTrailingEdge(horizontalAxis, x, width, MIN_BLOCK_WIDTH)

    width = clamped.size

    if (clamped.limit) limits.right = clamped.limit
  }

  if (input.edges.horizontal === "w") {
    const clamped = clampLeadingEdge(horizontalAxis, x, MIN_BLOCK_WIDTH)

    x = clamped.start
    width = clamped.size

    if (clamped.limit) limits.left = clamped.limit
  }

  return { rect: { x, y, width, height }, limits }
}

type ResizeAxisInput = {
  neighbours: { mainStart: number; mainEnd: number; crossStart: number; crossEnd: number }[]
  crossSpan: { start: number; end: number }
  originalStart: number
  originalEnd: number
  boundEnd: number
}

// Growing the trailing edge (right/bottom): the nearest neighbour start past the block's original
// end - or the page bound - is the hard stop.
function clampTrailingEdge(
  axis: ResizeAxisInput,
  start: number,
  size: number,
  minSize: number
): { size: number; limit?: ResizeLimit } {
  const limit = axis.neighbours
    .filter(
      (rect) =>
        spansIntersect(rect.crossStart, rect.crossEnd, axis.crossSpan.start, axis.crossSpan.end) &&
        rect.mainStart >= axis.originalEnd
    )
    .reduce((nearest, rect) => Math.min(nearest, rect.mainStart), axis.boundEnd)

  if (start + size <= limit) return { size }

  return {
    size: Math.max(limit - start, minSize),
    limit: { at: limit, kind: limit === axis.boundEnd ? "page" : "block" }
  }
}

// Growing the leading edge (left/top): the nearest neighbour end before the block's original start
// - or the content-box origin - is the hard stop; the trailing edge stays anchored.
function clampLeadingEdge(
  axis: ResizeAxisInput,
  start: number,
  minSize: number
): { start: number; size: number; limit?: ResizeLimit } {
  const anchor = axis.originalEnd

  const limit = axis.neighbours
    .filter(
      (rect) =>
        spansIntersect(rect.crossStart, rect.crossEnd, axis.crossSpan.start, axis.crossSpan.end) &&
        rect.mainEnd <= axis.originalStart
    )
    .reduce((nearest, rect) => Math.max(nearest, rect.mainEnd), 0)

  const clampedStart = Math.max(start, limit)
  const size = Math.max(anchor - clampedStart, minSize)

  return {
    start: anchor - size,
    size,
    ...(start < limit ? { limit: { at: limit, kind: limit === 0 ? "page" : "block" } } : {})
  }
}

// The save gate, run by updateTemplate after the schema parse: every block in bounds, and a
// line-items-bound table only on template types that carry the collection.
export function validateLayout(
  blocks: readonly Block[],
  pageSettings: TemplatePageSettings,
  type: TemplateType
): CanvasValidation {
  const bounds = getContentBounds(type, pageSettings)

  for (const block of blocks) {
    // A group never carries its own rotation, so its already-derived layout rect is the bound.
    const rotation = block.type === "group" ? 0 : (block.rotation ?? 0)
    const { x, y, width, height } = rotatedAabb(block.layout, rotation)

    if (x < 0 || y < 0 || x + width > bounds.width || y + height > bounds.height) {
      return { valid: false, reason: "outOfBounds" }
    }

    if (
      block.type === "table" &&
      block.content.source === "lineItems" &&
      !supportsLineItems(type)
    ) {
      return { valid: false, reason: "collectionUnavailable" }
    }
  }

  return { valid: true }
}

function spansIntersect(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
