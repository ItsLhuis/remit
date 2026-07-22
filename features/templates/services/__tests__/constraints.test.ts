import { describe, expect, test } from "vitest"

import { makeFrameBlock, makeGroupBlock, makeShapeBlock } from "@/tests/factories/blocks"

import { buildIndex } from "../blockIndex"
import { findBlock } from "../blockTree"
import { type ContentBounds } from "../canvasLayout"
import { applyFrameResize, resolveResizedBlocks } from "../constraints"
import { rotatedAabb } from "../geometry"

describe("applyFrameResize", () => {
  test("defaults an unconstrained child to start/start, pinning the top-left offset", () => {
    const child = makeShapeBlock({ id: "child", layout: { x: 8, y: 8, width: 100, height: 50 } })

    const [resized] = applyFrameResize(
      [child],
      { width: 200, height: 100 },
      { width: 320, height: 160 }
    )

    expect(resized?.layout).toEqual({ x: 8, y: 8, width: 100, height: 50 })
  })

  test("keeps the far-edge offset for an end-constrained axis", () => {
    const child = makeShapeBlock({
      id: "child",
      layout: { x: 100, y: 0, width: 80, height: 40 },
      constraints: { horizontal: "end", vertical: "start" }
    })

    const [resized] = applyFrameResize(
      [child],
      { width: 200, height: 100 },
      { width: 320, height: 100 }
    )

    // The frame grew 120px; an end-pinned child keeps its distance from the right edge, so its
    // start offset absorbs the whole delta.
    expect(resized?.layout).toMatchObject({ x: 220, width: 80 })
  })

  test("keeps a center-constrained child's center proportionally positioned", () => {
    const child = makeShapeBlock({
      id: "child",
      layout: { x: 90, y: 0, width: 20, height: 40 },
      constraints: { horizontal: "center", vertical: "start" }
    })

    const [resized] = applyFrameResize(
      [child],
      { width: 200, height: 100 },
      { width: 400, height: 100 }
    )

    // Center at old extent: 90 + 10 = 100, which is 50% of 200; at the doubled extent that is 200,
    // so the child's start offset becomes 200 - 10 = 190.
    expect(resized?.layout).toMatchObject({ x: 190, width: 20 })
  })

  test("stretches a stretch-constrained child's size by the frame's full delta", () => {
    const child = makeShapeBlock({
      id: "child",
      layout: { x: 0, y: 0, width: 100, height: 50 },
      constraints: { horizontal: "stretch", vertical: "start" }
    })

    const [resized] = applyFrameResize(
      [child],
      { width: 200, height: 100 },
      { width: 320, height: 100 }
    )

    expect(resized?.layout).toMatchObject({ x: 0, width: 220 })
  })

  test("floors a shrinking stretch child at the minimum block width", () => {
    const child = makeShapeBlock({
      id: "child",
      layout: { x: 0, y: 0, width: 60, height: 50 },
      constraints: { horizontal: "stretch", vertical: "start" }
    })

    const [resized] = applyFrameResize(
      [child],
      { width: 200, height: 100 },
      { width: 40, height: 100 }
    )

    expect(resized?.layout.width).toBe(48)
  })

  test("scales a scale-constrained child's position and size by the frame's factor", () => {
    const child = makeShapeBlock({
      id: "child",
      layout: { x: 20, y: 0, width: 40, height: 50 },
      constraints: { horizontal: "scale", vertical: "start" }
    })

    const [resized] = applyFrameResize(
      [child],
      { width: 200, height: 100 },
      { width: 400, height: 100 }
    )

    expect(resized?.layout).toMatchObject({ x: 40, width: 80 })
  })

  test("floors a shrinking scale child at the minimum block width", () => {
    const child = makeShapeBlock({
      id: "child",
      layout: { x: 0, y: 0, width: 60, height: 50 },
      constraints: { horizontal: "scale", vertical: "start" }
    })

    const [resized] = applyFrameResize(
      [child],
      { width: 600, height: 100 },
      { width: 60, height: 100 }
    )

    expect(resized?.layout.width).toBe(48)
  })
})

describe("resolveResizedBlocks", () => {
  const bounds: ContentBounds = { width: 794, height: 1123 }

  function stretchChild() {
    return makeShapeBlock({
      id: "child",
      layout: { x: 0, y: 0, width: 100, height: 50 },
      constraints: { horizontal: "stretch", vertical: "start" }
    })
  }

  test("reflows a sole frame target's children by their constraints instead of scaling them", () => {
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 0, y: 0, width: 200, height: 100 },
      children: [stretchChild()]
    })
    const index = buildIndex([frame])

    const next = resolveResizedBlocks(index, bounds, ["frame"], {
      x: 0,
      y: 0,
      width: 400,
      height: 100
    })
    const child = next && findBlock(next, "child")?.block

    expect(child?.layout).toMatchObject({ x: 0, width: 300 })
  })

  test("scales a group's members proportionally and ignores their constraints", () => {
    const group = makeGroupBlock({
      id: "group",
      layout: { x: 0, y: 0, width: 200, height: 100 },
      children: [stretchChild()]
    })
    const index = buildIndex([group])

    const next = resolveResizedBlocks(index, bounds, ["group"], {
      x: 0,
      y: 0,
      width: 400,
      height: 100
    })
    const child = next && findBlock(next, "child")?.block

    expect(child?.layout).toMatchObject({ width: 200 })
  })

  test("returns null when the target set has no resolvable bounds", () => {
    const index = buildIndex([makeShapeBlock({ id: "a" })])

    expect(
      resolveResizedBlocks(index, bounds, ["missing"], { x: 0, y: 0, width: 80, height: 80 })
    ).toBeNull()
  })

  test("scales a rotated sole target from its own rect so the committed rect matches the reference", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 200, width: 160, height: 40 }, rotation: 90 })
    ])

    const next = resolveResizedBlocks(index, bounds, ["a"], {
      x: 200,
      y: 200,
      width: 200,
      height: 40
    })
    const block = next && findBlock(next, "a")?.block

    expect(block?.layout).toEqual({ x: 200, y: 200, width: 200, height: 40 })
    expect(block?.type === "shape" ? block.rotation : undefined).toBe(90)
  })

  test("keeps a rotated sole target's footprint inside the page at commit", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 100, width: 160, height: 40 }, rotation: 90 })
    ])

    const next = resolveResizedBlocks(index, bounds, ["a"], {
      x: 200,
      y: 100,
      width: 400,
      height: 40
    })
    const block = next && findBlock(next, "a")?.block

    if (!block) throw new Error("expected a block")

    const rotation = block.type === "shape" ? (block.rotation ?? 0) : 0
    const aabb = rotatedAabb(block.layout, rotation)

    expect(aabb.y).toBeGreaterThanOrEqual(0)
    expect(aabb.x).toBeGreaterThanOrEqual(0)
  })
})
