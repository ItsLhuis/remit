import { describe, expect, test } from "vitest"

import { makeFrameBlock, makeGroupBlock, makeShapeBlock } from "@/tests/factories/blocks"

import { type Block } from "../../schemas"
import { buildIndex } from "../blockIndex"
import { findBlock } from "../blockTree"
import { getContentBounds, DEFAULT_PAGE_SETTINGS } from "../canvasLayout"
import { rotatedAabb } from "../geometry"
import {
  collectRotationMembers,
  resolveBlocksRotationTo,
  resolveRotatedBlocks
} from "../rotateMath"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function rotationOf(blocks: readonly Block[], id: string): number | undefined {
  const block = findBlock([...blocks], id)?.block

  return block === undefined || block.type === "group" ? undefined : block.rotation
}

describe("collectRotationMembers", () => {
  test("collects a single block with its own rect and rotation", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 100, y: 100, width: 160, height: 96 }, rotation: 30 })
    ])

    const set = collectRotationMembers(index, ["a"])

    expect(set?.members).toEqual([
      {
        id: "a",
        rect: { x: 100, y: 100, width: 160, height: 96 },
        rotation: 30,
        frameRect: null
      }
    ])
    expect(set?.center).toEqual({ x: 180, y: 148 })
  })

  test("expands a group into its children instead of the group itself", () => {
    const index = buildIndex([
      makeGroupBlock({
        id: "group",
        layout: { x: 100, y: 100, width: 400, height: 200 },
        children: [
          makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 160, height: 96 } }),
          makeShapeBlock({ id: "b", layout: { x: 240, y: 104, width: 160, height: 96 } })
        ]
      })
    ])

    const set = collectRotationMembers(index, ["group"])

    expect(set?.members.map((member) => member.id).sort()).toEqual(["a", "b"])
  })

  test("skips locked members and returns null when nothing rotatable remains", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 100, y: 100, width: 160, height: 96 }, locked: true })
    ])

    expect(collectRotationMembers(index, ["a"])).toBeNull()
  })
})

describe("resolveRotatedBlocks", () => {
  test("rotates a single block about its own center in place", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 200, width: 160, height: 96 } })
    ])

    const next = resolveRotatedBlocks(index, bounds, ["a"], 30)

    expect(next?.[0]?.layout).toEqual({ x: 200, y: 200, width: 160, height: 96 })
    expect(rotationOf(next ?? [], "a")).toBe(30)
  })

  test("accumulates onto an existing rotation and folds into [0, 360)", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 200, width: 160, height: 96 }, rotation: 350 })
    ])

    const next = resolveRotatedBlocks(index, bounds, ["a"], 20)

    expect(rotationOf(next ?? [], "a")).toBe(10)
  })

  test("strips the rotation field when a rotation lands back on zero", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 200, width: 160, height: 96 }, rotation: 90 })
    ])

    const next = resolveRotatedBlocks(index, bounds, ["a"], 270)
    const block = next?.[0]

    expect(block !== undefined && "rotation" in block).toBe(false)
  })

  test("returns null for a no-op delta", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 200, width: 160, height: 96 } })
    ])

    expect(resolveRotatedBlocks(index, bounds, ["a"], 0)).toBeNull()
    expect(resolveRotatedBlocks(index, bounds, ["a"], 360)).toBeNull()
  })

  test("rotates a multi-selection rigidly about the shared center", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 100, y: 100, width: 80, height: 80 } }),
      makeShapeBlock({ id: "b", layout: { x: 300, y: 300, width: 80, height: 80 } })
    ])

    const next = resolveRotatedBlocks(index, bounds, ["a", "b"], 180)

    expect(findBlock(next ?? [], "a")?.block.layout).toMatchObject({ x: 300, y: 300 })
    expect(findBlock(next ?? [], "b")?.block.layout).toMatchObject({ x: 100, y: 100 })
    expect(rotationOf(next ?? [], "a")).toBe(180)
    expect(rotationOf(next ?? [], "b")).toBe(180)
  })

  test("rotates a group's children and never writes rotation onto the group", () => {
    const index = buildIndex([
      makeGroupBlock({
        id: "group",
        layout: { x: 100, y: 100, width: 400, height: 200 },
        children: [
          makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 160, height: 96 } }),
          makeShapeBlock({ id: "b", layout: { x: 240, y: 104, width: 160, height: 96 } })
        ]
      })
    ])

    const next = resolveRotatedBlocks(index, bounds, ["group"], 45)
    const group = next?.[0]

    expect(group !== undefined && "rotation" in group).toBe(false)
    expect(rotationOf(next ?? [], "a")).toBe(45)
    expect(rotationOf(next ?? [], "b")).toBe(45)
  })

  test("keeps a locked member untouched while the rest of the set rotates", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 100, y: 100, width: 80, height: 80 } }),
      makeShapeBlock({ id: "b", layout: { x: 300, y: 300, width: 80, height: 80 }, locked: true })
    ])

    const next = resolveRotatedBlocks(index, bounds, ["a", "b"], 90)

    expect(rotationOf(next ?? [], "a")).toBe(90)
    expect(rotationOf(next ?? [], "b")).toBeUndefined()
    expect(findBlock(next ?? [], "b")?.block.layout).toMatchObject({ x: 300, y: 300 })
  })

  test("translates the rotated set back inside the page bounds", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 0, y: 0, width: 160, height: 40 } })
    ])

    const next = resolveRotatedBlocks(index, bounds, ["a"], 45)
    const block = findBlock(next ?? [], "a")?.block

    if (!block) throw new Error("expected a block")

    const aabb = rotatedAabb(block.layout, 45)

    expect(aabb.x).toBeGreaterThanOrEqual(0)
    expect(aabb.y).toBeGreaterThanOrEqual(0)
  })

  test("floors a rotated frame child's footprint at the frame's origin", () => {
    const child = makeShapeBlock({ id: "child", layout: { x: 0, y: 0, width: 100, height: 40 } })
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 80, y: 80, width: 320, height: 240 },
      children: [child]
    })
    const index = buildIndex([frame])

    const next = resolveRotatedBlocks(index, bounds, ["child"], 90)
    const rotatedChild = findBlock(next ?? [], "child")?.block

    if (!rotatedChild) throw new Error("expected a child block")

    const pageRect = {
      ...rotatedChild.layout,
      x: rotatedChild.layout.x + 80,
      y: rotatedChild.layout.y + 80
    }
    const aabb = rotatedAabb(pageRect, 90)

    expect(aabb.x).toBeGreaterThanOrEqual(80)
    expect(aabb.y).toBeGreaterThanOrEqual(80)
  })

  test("quantizes the applied delta to a tenth of a degree", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 200, width: 160, height: 96 } })
    ])

    const next = resolveRotatedBlocks(index, bounds, ["a"], 30.04)

    expect(rotationOf(next ?? [], "a")).toBe(30)
  })
})

describe("resolveBlocksRotationTo", () => {
  test("sets an absolute rotation about each member's own center", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 100, y: 100, width: 80, height: 80 }, rotation: 10 }),
      makeShapeBlock({ id: "b", layout: { x: 300, y: 300, width: 80, height: 80 }, rotation: 200 })
    ])

    const next = resolveBlocksRotationTo(index, bounds, ["a", "b"], 45)

    expect(rotationOf(next ?? [], "a")).toBe(45)
    expect(rotationOf(next ?? [], "b")).toBe(45)
    expect(findBlock(next ?? [], "a")?.block.layout).toMatchObject({ x: 100, y: 100 })
    expect(findBlock(next ?? [], "b")?.block.layout).toMatchObject({ x: 300, y: 300 })
  })

  test("folds the requested value into [0, 360) before storing it", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 200, width: 160, height: 96 } })
    ])

    const next = resolveBlocksRotationTo(index, bounds, ["a"], 370)

    expect(rotationOf(next ?? [], "a")).toBe(10)
  })

  test("returns null when every member already carries the requested rotation", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "a", layout: { x: 200, y: 200, width: 160, height: 96 }, rotation: 45 })
    ])

    expect(resolveBlocksRotationTo(index, bounds, ["a"], 45)).toBeNull()
  })
})
