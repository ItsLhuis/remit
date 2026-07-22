import { describe, expect, test } from "vitest"

import { MIN_BLOCK_HEIGHT, type Block, type TemplatePageSettings } from "../../schemas"
import {
  clampRectToBounds,
  clampResizeRectToBounds,
  contentMinHeight,
  findFreePosition,
  getContentBounds,
  getPageHeight,
  overlaps,
  quantizeToGrid,
  reflowToBounds,
  resolveResize,
  validateLayout,
  DEFAULT_PAGE_SETTINGS,
  DOCUMENT_MIN_PAGE_HEIGHT
} from "../canvasLayout"

const pageSettings: TemplatePageSettings = DEFAULT_PAGE_SETTINGS

// 794 - 32 - 32 = 730, floored to the grid = 728.
const bounds = getContentBounds("invoice", pageSettings)

function makeText(id: string, layout: Block["layout"]): Block {
  return { id, type: "text", layout, hidden: false, locked: false, content: { html: id } }
}

function makeRotatedText(id: string, layout: Block["layout"], rotation: number): Block {
  return { id, type: "text", layout, rotation, hidden: false, locked: false, content: { html: id } }
}

describe("overlaps", () => {
  test("detects intersecting rectangles", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const b = { x: 50, y: 50, width: 100, height: 100 }

    expect(overlaps(a, b)).toBe(true)
  })

  test("treats shared edges as non-overlapping", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const b = { x: 100, y: 0, width: 100, height: 100 }
    const c = { x: 0, y: 100, width: 100, height: 100 }

    expect(overlaps(a, b)).toBe(false)
    expect(overlaps(a, c)).toBe(false)
  })

  test("treats disjoint rectangles as non-overlapping", () => {
    const a = { x: 0, y: 0, width: 40, height: 40 }
    const b = { x: 200, y: 300, width: 40, height: 40 }

    expect(overlaps(a, b)).toBe(false)
  })
})

describe("quantizeToGrid", () => {
  test("rounds to the nearest grid cell", () => {
    expect(quantizeToGrid(11)).toBe(8)
    expect(quantizeToGrid(13)).toBe(16)
    expect(quantizeToGrid(0)).toBe(0)
  })
})

describe("getContentBounds", () => {
  test("floors the content width to a whole grid cell", () => {
    expect(bounds.width).toBe(728)
  })

  test("uses the email page width for email types", () => {
    const emailBounds = getContentBounds("email_invoice_send", pageSettings)

    expect(emailBounds.width).toBe(536)
  })
})

describe("clampRectToBounds", () => {
  test("shifts a rectangle back inside the content box", () => {
    const rect = clampRectToBounds({ x: -16, y: -8, width: 96, height: 32 }, bounds)

    expect(rect).toEqual({ x: 0, y: 0, width: 96, height: 32 })
  })

  test("clamps the far edge against the content width", () => {
    const rect = clampRectToBounds({ x: 720, y: 0, width: 96, height: 32 }, bounds)

    expect(rect.x + rect.width).toBeLessThanOrEqual(bounds.width)
  })

  test("shrinks a rectangle wider than the content box", () => {
    const rect = clampRectToBounds({ x: 0, y: 0, width: 2000, height: 32 }, bounds)

    expect(rect.width).toBe(bounds.width)
  })
})

describe("clampResizeRectToBounds", () => {
  test("shrinks the crossing edge and keeps the anchored edge in place", () => {
    const { rect, limits } = clampResizeRectToBounds(
      { x: 500, y: 0, width: 400, height: 32 },
      bounds
    )

    expect(rect).toEqual({ x: 500, y: 0, width: bounds.width - 500, height: 32 })
    expect(limits).toEqual({ right: bounds.width })
  })

  test("pulls a negative leading edge to zero without moving the trailing edge", () => {
    const { rect, limits } = clampResizeRectToBounds(
      { x: -40, y: -8, width: 200, height: 64 },
      bounds
    )

    expect(rect).toEqual({ x: 0, y: 0, width: 160, height: 56 })
    expect(limits).toEqual({ left: 0, top: 0 })
  })

  test("does not quantize an off-grid size and reports no limits when in bounds", () => {
    const { rect, limits } = clampResizeRectToBounds(
      { x: 70, y: 10, width: 101, height: 33 },
      bounds
    )

    expect(rect).toEqual({ x: 70, y: 10, width: 101, height: 33 })
    expect(limits).toEqual({})
  })
})

describe("resolveResize", () => {
  test("clamps growth at the page content bound", () => {
    const block = makeText("a", { x: 640, y: 0, width: 80, height: 32 })

    const resolved = resolveResize([block], bounds, "a", {
      rect: { x: 640, y: 0, width: 200, height: 32 },
      edges: { horizontal: "e" }
    })

    expect(resolved.rect.width).toBe(bounds.width - 640)
    expect(resolved.limits.right).toEqual({ at: bounds.width, kind: "page" })
  })

  test("ignores other blocks because overlap is legal", () => {
    const block = makeText("a", { x: 0, y: 0, width: 96, height: 64 })
    const neighbour = makeText("b", { x: 200, y: 0, width: 96, height: 64 })

    const resolved = resolveResize([block, neighbour], bounds, "a", {
      rect: { x: 0, y: 0, width: 400, height: 64 },
      edges: { horizontal: "e" }
    })

    expect(resolved.rect.width).toBe(400)
    expect(resolved.limits.right).toBeUndefined()
  })

  test("clamps a leading-edge resize at the page origin", () => {
    const block = makeText("a", { x: 200, y: 0, width: 96, height: 64 })

    const resolved = resolveResize([block], bounds, "a", {
      rect: { x: -40, y: 0, width: 336, height: 64 },
      edges: { horizontal: "w" }
    })

    expect(resolved.rect.x).toBe(0)
    expect(resolved.rect.x + resolved.rect.width).toBe(296)
    expect(resolved.limits.left).toEqual({ at: 0, kind: "page" })
  })

  test("clamps downward growth at the page bottom", () => {
    const block = makeText("a", { x: 0, y: bounds.height - 64, width: 96, height: 64 })

    const resolved = resolveResize([block], bounds, "a", {
      rect: { x: 0, y: bounds.height - 64, width: 96, height: 400 },
      edges: { vertical: "s" }
    })

    expect(resolved.rect.height).toBe(64)
    expect(resolved.limits.bottom).toEqual({ at: bounds.height, kind: "page" })
  })

  test("never shrinks below the minimum block size", () => {
    const block = makeText("a", { x: 0, y: 0, width: 96, height: 64 })

    const resolved = resolveResize([block], bounds, "a", {
      rect: { x: 0, y: 0, width: 0, height: 0 },
      edges: { horizontal: "e", vertical: "s" }
    })

    expect(resolved.rect.width).toBeGreaterThanOrEqual(48)
    expect(resolved.rect.height).toBeGreaterThanOrEqual(16)
  })
})

describe("validateLayout", () => {
  test("accepts non-overlapping in-bounds blocks", () => {
    const blocks = [
      makeText("a", { x: 0, y: 0, width: 96, height: 32 }),
      makeText("b", { x: 0, y: 40, width: 96, height: 32 })
    ]

    expect(validateLayout(blocks, pageSettings, "invoice")).toEqual({ valid: true })
  })

  test("accepts overlapping blocks because the model is layered", () => {
    const blocks = [
      makeText("a", { x: 0, y: 0, width: 96, height: 32 }),
      makeText("b", { x: 40, y: 16, width: 96, height: 32 })
    ]

    expect(validateLayout(blocks, pageSettings, "invoice")).toEqual({ valid: true })
  })

  test("rejects a block past the content width", () => {
    const blocks = [makeText("a", { x: 688, y: 0, width: 96, height: 32 })]

    expect(validateLayout(blocks, pageSettings, "invoice")).toEqual({
      valid: false,
      reason: "outOfBounds"
    })
  })

  test("rejects a line-items table on a type without line items", () => {
    const table: Block = {
      id: "t",
      type: "table",
      layout: { x: 0, y: 0, width: 480, height: 160 },
      hidden: false,
      locked: false,
      content: {
        source: "lineItems",
        columns: [{ id: "c1", header: "Item", width: null, binding: "lineItem.description" }],
        rows: []
      }
    }

    expect(validateLayout([table], pageSettings, "contract")).toEqual({
      valid: false,
      reason: "collectionUnavailable"
    })

    expect(validateLayout([table], pageSettings, "invoice")).toEqual({ valid: true })
  })

  test("accepts a rotated block whose rotated footprint stays inside the content box", () => {
    const rotated = makeRotatedText("a", { x: 200, y: 200, width: 200, height: 48 }, 90)

    expect(validateLayout([rotated], pageSettings, "invoice")).toEqual({ valid: true })
  })

  test("rejects a block whose rotated footprint leaves the page even though its unrotated rect fits", () => {
    const layout = { x: 0, y: 0, width: 200, height: 48 }

    expect(validateLayout([makeText("a", layout)], pageSettings, "invoice")).toEqual({
      valid: true
    })
    expect(validateLayout([makeRotatedText("a", layout, 90)], pageSettings, "invoice")).toEqual({
      valid: false,
      reason: "outOfBounds"
    })
  })
})

describe("findFreePosition", () => {
  test("places the first block at the content-box origin", () => {
    const rect = findFreePosition([], { width: 96, height: 32 }, bounds)

    expect(rect).toEqual({ x: 0, y: 0, width: 96, height: 32 })
  })

  test("places a new block below the lowest existing block", () => {
    const blocks = [
      makeText("a", { x: 0, y: 0, width: 96, height: 32 }),
      makeText("b", { x: 200, y: 80, width: 96, height: 64 })
    ]

    const rect = findFreePosition(blocks, { width: 96, height: 32 }, bounds)

    expect(rect.y).toBe(152)
    expect(rect.x).toBe(0)
  })
})

describe("reflowToBounds", () => {
  test("clamps blocks into a narrower content box", () => {
    const wide = getContentBounds("invoice", pageSettings)
    const blocks = [
      makeText("a", { x: wide.width - 96, y: 0, width: 96, height: 32 }),
      makeText("b", { x: 0, y: 0, width: 96, height: 32 })
    ]

    const narrow = getContentBounds("invoice", {
      ...pageSettings,
      margins: { ...pageSettings.margins, left: 96, right: 96 }
    })

    const reflowed = reflowToBounds(blocks, narrow)

    for (const block of reflowed) {
      expect(block.layout.x + block.layout.width).toBeLessThanOrEqual(narrow.width)
    }
  })
})

describe("getPageHeight", () => {
  test("documents never shrink below one page", () => {
    expect(getPageHeight([], "invoice", pageSettings)).toBe(DOCUMENT_MIN_PAGE_HEIGHT)
  })

  test("the page grows with content past one page", () => {
    const tall = makeText("a", { x: 0, y: 1600, width: 96, height: 200 })

    expect(getPageHeight([tall], "invoice", pageSettings)).toBe(32 + 1800 + 32)
  })

  test("hidden blocks do not grow the page", () => {
    const hidden = { ...makeText("a", { x: 0, y: 1600, width: 96, height: 200 }), hidden: true }

    expect(getPageHeight([hidden], "invoice", pageSettings)).toBe(DOCUMENT_MIN_PAGE_HEIGHT)
  })
})

describe("contentMinHeight", () => {
  test("quantizes a measured content height up to whole grid cells", () => {
    expect(contentMinHeight(1)).toBe(MIN_BLOCK_HEIGHT)
    expect(contentMinHeight(16)).toBe(16)
    expect(contentMinHeight(17)).toBe(24)
    expect(contentMinHeight(63.2)).toBe(64)
  })

  test("never returns below the minimum block height", () => {
    expect(contentMinHeight(0)).toBe(MIN_BLOCK_HEIGHT)
    expect(contentMinHeight(-5)).toBe(MIN_BLOCK_HEIGHT)
  })
})
