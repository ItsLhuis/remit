import { describe, expect, test } from "vitest"

import {
  makeFrameBlock,
  makeGroupBlock,
  makeShapeBlock,
  makeTextBlock
} from "@/tests/factories/blocks"

import { GRID_SIZE } from "../../schemas"
import { DEFAULT_PAGE_SETTINGS, getContentBounds } from "../canvasLayout"
import {
  applyStyleToBlock,
  extractStyle,
  materializePastedBlocks,
  serializeSelection
} from "../clipboard"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

describe("serializeSelection", () => {
  test("returns the blocks matching the selected top-level ids, in selection order", () => {
    const a = makeShapeBlock({ id: "a" })
    const b = makeShapeBlock({ id: "b" })

    const result = serializeSelection([a, b], ["b", "a"])

    expect(result).toEqual([b, a])
  })

  test("resolves a selected id nested inside a frame", () => {
    const child = makeShapeBlock({ id: "child" })
    const frame = makeFrameBlock({ id: "frame", children: [child] })

    const result = serializeSelection([frame], ["child"])

    expect(result).toEqual([child])
  })

  test("returns null when none of the selected ids exist in the tree", () => {
    const a = makeShapeBlock({ id: "a" })

    const result = serializeSelection([a], ["missing"])

    expect(result).toBeNull()
  })
})

describe("materializePastedBlocks", () => {
  test("offsets each pasted block one grid cell down-right when no anchor is given", () => {
    const source = makeShapeBlock({ id: "a", layout: { x: 40, y: 40, width: 160, height: 96 } })

    const [pasted] = materializePastedBlocks([source], bounds)

    expect(pasted?.layout).toMatchObject({ x: 40 + GRID_SIZE, y: 40 + GRID_SIZE })
  })

  test("assigns every pasted block a fresh id", () => {
    const source = makeShapeBlock({ id: "a" })

    const [pasted] = materializePastedBlocks([source], bounds)

    expect(pasted?.id).not.toBe("a")
  })

  test("positions the pasted set's bounding box top-left at the anchor point, preserving relative offsets", () => {
    const a = makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 80, height: 80 } })
    const b = makeShapeBlock({ id: "b", layout: { x: 80, y: 40, width: 80, height: 80 } })

    const [pastedA, pastedB] = materializePastedBlocks([a, b], bounds, { x: 200, y: 160 })

    expect(pastedA?.layout).toMatchObject({ x: 200, y: 160 })
    expect(pastedB?.layout).toMatchObject({ x: 280, y: 200 })
  })

  test("clamps a pasted block back inside the content bounds", () => {
    const source = makeShapeBlock({
      id: "a",
      layout: { x: bounds.width - 40, y: 40, width: 160, height: 96 }
    })

    const [pasted] = materializePastedBlocks([source], bounds)

    expect(pasted).toBeDefined()
    expect(pasted && pasted.layout.x + pasted.layout.width).toBeLessThanOrEqual(bounds.width)
  })

  test("returns an empty array for an empty payload", () => {
    expect(materializePastedBlocks([], bounds)).toEqual([])
  })

  test("reassigns nested ids so a pasted frame shares no child id with its source", () => {
    const child = makeShapeBlock({ id: "child" })
    const frame = makeFrameBlock({ id: "frame", children: [child] })

    const [pasted] = materializePastedBlocks([frame], bounds)
    const pastedChild = pasted?.type === "frame" ? pasted.content.children[0] : undefined

    expect(pastedChild?.id).not.toBe("child")
  })
})

describe("extractStyle", () => {
  test("returns the block's own style", () => {
    const block = makeTextBlock({ id: "a" })
    const styled = { ...block, style: { fontSize: 16 } }

    expect(extractStyle(styled)).toEqual({ fontSize: 16 })
  })

  test("returns undefined for a block with no style", () => {
    const block = makeTextBlock({ id: "a" })

    expect(extractStyle(block)).toBeUndefined()
  })

  test("returns undefined for a group, which never carries style", () => {
    const child = makeShapeBlock({ id: "child" })
    const group = makeGroupBlock({ id: "group", children: [child] })

    expect(extractStyle(group)).toBeUndefined()
  })
})

describe("applyStyleToBlock", () => {
  test("replaces the block's style with the given style", () => {
    const block = { ...makeTextBlock({ id: "a" }), style: { fontSize: 12 } }

    const result = applyStyleToBlock(block, { fontSize: 24 })

    expect(result.type === "group" ? undefined : result.style).toEqual({ fontSize: 24 })
  })

  test("strips the block's style entirely when applying undefined", () => {
    const block = { ...makeTextBlock({ id: "a" }), style: { fontSize: 12 } }

    const result = applyStyleToBlock(block, undefined)

    expect(result.type === "group" ? undefined : result.style).toBeUndefined()
  })

  test("leaves a group block unchanged", () => {
    const child = makeShapeBlock({ id: "child" })
    const group = makeGroupBlock({ id: "group", children: [child] })

    expect(applyStyleToBlock(group, { fontSize: 24 })).toBe(group)
  })
})
