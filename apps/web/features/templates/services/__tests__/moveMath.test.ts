import { describe, expect, test } from "vitest"

import { makeFrameBlock, makeShapeBlock } from "@/tests/factories/blocks"

import { buildIndex } from "../blockIndex"
import { findBlock } from "../blockTree"
import { getContentBounds, DEFAULT_PAGE_SETTINGS } from "../canvasLayout"
import { rotatedAabb } from "../geometry"
import { resolveMovedBlocks } from "../moveMath"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

describe("resolveMovedBlocks with rotated members", () => {
  test("keeps an unrotated block's clamp behavior unchanged", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 40, y: 40, width: 160, height: 96 } })
    ])

    const next = resolveMovedBlocks(index, bounds, ["a"], { x: -200, y: -200 })

    expect(findBlock(next ?? [], "a")?.block.layout).toMatchObject({ x: 0, y: 0 })
  })

  test("clamps a rotated block by its rotated footprint, not its raw rect", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 200, width: 160, height: 40 }, rotation: 90 })
    ])

    const next = resolveMovedBlocks(index, bounds, ["a"], { x: 0, y: -160 })
    const block = findBlock(next ?? [], "a")?.block

    if (!block) throw new Error("expected a block")

    const aabb = rotatedAabb(block.layout, 90)

    expect(aabb.y).toBeGreaterThanOrEqual(0)
    expect(block.layout.y).toBe(60)
  })

  test("floors a rotated frame child at the frame origin by its footprint", () => {
    const child = makeShapeBlock({
      id: "child",
      layout: { x: 60, y: 60, width: 100, height: 40 },
      rotation: 90
    })
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 80, y: 80, width: 320, height: 240 },
      children: [child]
    })
    const index = buildIndex([frame])

    const next = resolveMovedBlocks(index, bounds, ["child"], { x: -200, y: -200 })
    const moved = findBlock(next ?? [], "child")?.block

    if (!moved) throw new Error("expected a child block")

    const pageRect = { ...moved.layout, x: moved.layout.x + 80, y: moved.layout.y + 80 }
    const aabb = rotatedAabb(pageRect, 90)

    expect(aabb.x).toBeGreaterThanOrEqual(80)
    expect(aabb.y).toBeGreaterThanOrEqual(80)
  })
})
