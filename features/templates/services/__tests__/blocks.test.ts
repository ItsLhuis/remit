import { describe, expect, test } from "vitest"

import { blocksSchema, BLOCK_CAPABILITIES, BLOCK_TYPES, type Block } from "../../schemas"
import {
  addBlock,
  addShape,
  createBlock,
  duplicateBlock,
  containerNestingDepth,
  getBlockPalette,
  BLOCK_PROPERTY_GROUPS
} from "../blocks"
import { getContentBounds, overlaps, DEFAULT_PAGE_SETTINGS } from "../canvasLayout"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function makeTextChild(): Block {
  return {
    id: crypto.randomUUID(),
    type: "text",
    layout: { x: 0, y: 0, width: 240, height: 32 },
    hidden: false,
    locked: false,
    content: { html: "child" }
  }
}

function makeFrameBlock(overrides: { children: Block[] }): Block {
  return {
    id: crypto.randomUUID(),
    type: "frame",
    layout: { x: 0, y: 0, width: 480, height: 120 },
    hidden: false,
    locked: false,
    content: { clip: false, children: overrides.children }
  }
}

function expectNoOverlap(blocks: readonly Block[]) {
  for (const first of blocks) {
    for (const second of blocks) {
      if (first.id === second.id) continue

      expect(overlaps(first.layout, second.layout)).toBe(false)
    }
  }
}

describe("palette and capability data", () => {
  test("every block type carries a capability and a property-group entry", () => {
    for (const type of BLOCK_TYPES) {
      expect(BLOCK_CAPABILITIES[type]).toBeDefined()
      expect(BLOCK_PROPERTY_GROUPS[type]).toBeDefined()
    }
  })

  test("exposes the five block types with no heading", () => {
    expect([...getBlockPalette()].toSorted()).toEqual(
      ["frame", "image", "shape", "table", "text"].toSorted()
    )
  })
})

describe("createBlock", () => {
  test("spawns a text block at its natural minimum size, never full width", () => {
    const block = createBlock("text", bounds)

    expect(block.layout).toEqual({ x: 0, y: 0, width: 240, height: 32 })
  })

  test("spawns an image at its natural minimum size", () => {
    const block = createBlock("image", bounds)

    expect(block.layout).toEqual({ x: 0, y: 0, width: 160, height: 160 })
  })

  test("spawns a manual table with three columns and matching cells", () => {
    const block = createBlock("table", bounds)

    if (block.type !== "table") throw new Error("expected a table block")

    expect(block.content.source).toBe("manual")
    expect(block.content.columns).toHaveLength(3)

    for (const row of block.content.rows) {
      expect(row.cells).toHaveLength(3)
    }
  })

  test("spawns an unclipped frame with no children", () => {
    const block = createBlock("frame", bounds)

    if (block.type !== "frame") throw new Error("expected a frame block")

    expect(block.content.clip).toBe(false)
    expect(block.content.children).toEqual([])
  })

  test("spawns a rectangle shape at its natural size", () => {
    const block = createBlock("shape", bounds)

    if (block.type !== "shape") throw new Error("expected a shape block")

    expect(block.content.variant).toBe("rectangle")
    expect(block.layout).toEqual({ x: 0, y: 0, width: 160, height: 96 })
  })
})

describe("addBlock", () => {
  test("places the first block at the content-box origin", () => {
    const insertion = addBlock([], "text", bounds)

    expect(insertion.block?.layout.x).toBe(0)
    expect(insertion.block?.layout.y).toBe(0)
  })

  test("places the next block below the lowest existing block without overlap", () => {
    const first = addBlock([], "image", bounds)
    const second = addBlock(first.blocks, "text", bounds)

    expect(second.block?.layout.y).toBe(168)
    expectNoOverlap(second.blocks)
  })
})

describe("addShape", () => {
  test("creates a shape at the chosen variant rather than the rectangle default", () => {
    const insertion = addShape([], "ellipse", bounds)

    expect(insertion.block?.type).toBe("shape")
    expect(insertion.block?.content).toEqual({ variant: "ellipse" })
    expect(insertion.blocks).toHaveLength(1)
  })

  test("appends the shape below existing blocks without overlap", () => {
    const first = addBlock([], "image", bounds)
    const second = addShape(first.blocks, "line", bounds)

    expect(second.blocks).toHaveLength(2)
    expectNoOverlap(second.blocks)
  })
})

describe("duplicateBlock", () => {
  test("offsets the clone one grid cell down-right of the source and appends it on top", () => {
    const { blocks } = addBlock([], "text", bounds)

    const result = duplicateBlock(blocks, blocks[0]?.id ?? "", bounds)

    const source = result.blocks[0]
    const clone = result.blocks[1]

    expect(result.block).not.toBeNull()
    expect(result.blocks).toHaveLength(2)
    expect(clone?.layout.x).toBe((source?.layout.x ?? 0) + 8)
    expect(clone?.layout.y).toBe((source?.layout.y ?? 0) + 8)
    expect(clone?.id).toBe(result.block?.id)
  })

  test("regenerates the clone id when duplicating a frame", () => {
    const { blocks, block } = addBlock([], "frame", bounds)

    const result = duplicateBlock(blocks, block?.id ?? "", bounds)

    expect(result.block).not.toBeNull()
    expect(result.block?.id).not.toBe(block?.id)
  })

  test("regenerates ids at every level when duplicating a nested frame", () => {
    const child = makeTextChild()
    const inner = makeFrameBlock({ children: [child] })
    const outer = makeFrameBlock({ children: [inner] })

    const result = duplicateBlock([outer], outer.id, bounds)
    const clone = result.block

    if (clone?.type !== "frame") throw new Error("expected a frame clone")

    const clonedInner = clone.content.children[0]

    if (clonedInner?.type !== "frame") throw new Error("expected a nested frame clone")

    expect(clone.id).not.toBe(outer.id)
    expect(clonedInner.id).not.toBe(inner.id)
    expect(clonedInner.content.children[0]?.id).not.toBe(child.id)
  })

  test("clones a nested frame child in place, inside the same parent, instead of dropping it", () => {
    const child = makeTextChild()
    const frame = makeFrameBlock({ children: [child] })

    const result = duplicateBlock([frame], child.id, bounds)

    expect(result.block).not.toBeNull()
    expect(result.blocks).toHaveLength(1)

    const resultFrame = result.blocks[0]
    const children = resultFrame?.type === "frame" ? resultFrame.content.children : []

    expect(children).toHaveLength(2)
    expect(children[1]?.id).toBe(result.block?.id)
    expect(children[1]?.layout).toMatchObject({ x: child.layout.x + 8, y: child.layout.y + 8 })
  })

  test("clones a child nested two frames deep into its own immediate parent, not the outer frame", () => {
    const child = makeTextChild()
    const inner = makeFrameBlock({ children: [child] })
    const outer = makeFrameBlock({ children: [inner] })

    const result = duplicateBlock([outer], child.id, bounds)

    const resultOuter = result.blocks[0]
    const resultInner = resultOuter?.type === "frame" ? resultOuter.content.children[0] : undefined

    if (resultInner?.type !== "frame") throw new Error("expected the inner frame to survive")

    expect(resultOuter?.type === "frame" ? resultOuter.content.children : []).toHaveLength(1)
    expect(resultInner.content.children).toHaveLength(2)
    expect(resultInner.content.children[1]?.id).toBe(result.block?.id)
  })
})

describe("frame recursion", () => {
  test("accepts a frame nested one level inside a frame", () => {
    const nested = makeFrameBlock({ children: [makeTextChild()] })
    const parent = makeFrameBlock({ children: [nested] })

    expect(blocksSchema.safeParse([parent]).success).toBe(true)
  })

  test("rejects a frame nested beyond the depth bound", () => {
    const level3 = makeFrameBlock({ children: [makeTextChild()] })
    const level2 = makeFrameBlock({ children: [level3] })
    const level1 = makeFrameBlock({ children: [level2] })

    expect(blocksSchema.safeParse([level1]).success).toBe(false)
  })

  test("reports frame nesting depth", () => {
    expect(containerNestingDepth(makeTextChild())).toBe(0)
    expect(containerNestingDepth(makeFrameBlock({ children: [] }))).toBe(1)
    expect(
      containerNestingDepth(makeFrameBlock({ children: [makeFrameBlock({ children: [] })] }))
    ).toBe(2)
  })
})
