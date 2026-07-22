import { describe, expect, test } from "vitest"

import {
  makeFrameBlock,
  makeGroupBlock,
  makeShapeBlock,
  makeTextBlock
} from "@/tests/factories/blocks"

import {
  ancestorChainOf,
  buildIndex,
  collectResizeMemberIds,
  descendInto,
  topLevelAncestorOf,
  toTree,
  updateRects
} from "../blockIndex"

function nestedFixture() {
  const child = makeTextBlock({ id: "child", layout: { x: 16, y: 24, width: 96, height: 32 } })
  const inner = makeFrameBlock({
    id: "inner",
    layout: { x: 40, y: 40, width: 240, height: 120 },
    children: [child]
  })
  const outer = makeFrameBlock({
    id: "outer",
    layout: { x: 80, y: 80, width: 480, height: 240 },
    children: [inner]
  })
  const sibling = makeShapeBlock({ id: "sibling", layout: { x: 600, y: 0 } })

  return [outer, sibling]
}

describe("buildIndex", () => {
  test("indexes every block with parentage, depth, and sibling order", () => {
    const index = buildIndex(nestedFixture())

    expect(index.size).toBe(4)
    expect(index.get("outer")?.parentId).toBeNull()
    expect(index.get("outer")?.depth).toBe(0)
    expect(index.get("outer")?.childIds).toEqual(["inner"])
    expect(index.get("inner")?.parentId).toBe("outer")
    expect(index.get("inner")?.depth).toBe(1)
    expect(index.get("child")?.parentId).toBe("inner")
    expect(index.get("child")?.depth).toBe(2)
    expect(index.get("sibling")?.siblingIndex).toBe(1)
  })

  test("computes absolute page rects by accumulating parent offsets", () => {
    const index = buildIndex(nestedFixture())

    expect(index.get("outer")?.pageRect).toEqual({ x: 80, y: 80, width: 480, height: 240 })
    expect(index.get("inner")?.pageRect).toEqual({ x: 120, y: 120, width: 240, height: 120 })
    expect(index.get("child")?.pageRect).toEqual({ x: 136, y: 144, width: 96, height: 32 })
  })

  test("carries zero rotation while the block stores none", () => {
    const index = buildIndex(nestedFixture())

    expect(index.get("child")?.rotation).toBe(0)
  })

  test("carries a block's persisted rotation into its entry, at any depth", () => {
    const rotatedChild = makeTextBlock({
      id: "rotatedChild",
      layout: { x: 16, y: 16, width: 96, height: 32 },
      rotation: 30
    })
    const index = buildIndex([
      makeShapeBlock({ id: "rotatedTop", layout: { x: 600, y: 0 }, rotation: 45 }),
      makeFrameBlock({ id: "frame", layout: { x: 0, y: 0 }, children: [rotatedChild] })
    ])

    expect(index.get("rotatedTop")?.rotation).toBe(45)
    expect(index.get("rotatedChild")?.rotation).toBe(30)
  })

  test("a group entry always carries zero rotation of its own", () => {
    const rotatedMember = makeShapeBlock({
      id: "member",
      layout: { x: 0, y: 0, width: 96, height: 96 },
      rotation: 15
    })
    const group = makeGroupBlock({
      id: "group",
      layout: { x: 0, y: 0, width: 96, height: 96 },
      children: [rotatedMember]
    })
    const index = buildIndex([group])

    expect(index.get("group")?.rotation).toBe(0)
    expect(index.get("member")?.rotation).toBe(15)
  })
})

describe("toTree", () => {
  test("round-trips the tree it was built from", () => {
    const blocks = nestedFixture()

    expect(toTree(buildIndex(blocks))).toEqual(blocks)
  })

  test("preserves leaf block identity so unchanged blocks skip re-rendering", () => {
    const blocks = nestedFixture()
    const tree = toTree(buildIndex(blocks))

    expect(tree[1]).toBe(blocks[1])
  })
})

describe("updateRects", () => {
  test("applies a page-space edit to a top-level block", () => {
    const blocks = nestedFixture()

    const next = updateRects(
      buildIndex(blocks),
      new Map([["sibling", { x: 320, y: 160, width: 160, height: 96 }]])
    )

    const sibling = next.find((block) => block.id === "sibling")

    expect(sibling?.layout).toEqual({ x: 320, y: 160, width: 160, height: 96 })
  })

  test("converts a nested block's page-space edit into parent-local coordinates", () => {
    const blocks = nestedFixture()

    const next = updateRects(
      buildIndex(blocks),
      new Map([["child", { x: 160, y: 160, width: 96, height: 32 }]])
    )

    const index = buildIndex(next)

    expect(index.get("child")?.pageRect).toEqual({ x: 160, y: 160, width: 96, height: 32 })
    expect(index.get("child")?.block.layout).toEqual({ x: 40, y: 40, width: 96, height: 32 })
  })

  test("moving a frame keeps its children's local offsets so they travel with it", () => {
    const blocks = nestedFixture()

    const next = updateRects(
      buildIndex(blocks),
      new Map([["outer", { x: 160, y: 160, width: 480, height: 240 }]])
    )

    const index = buildIndex(next)

    expect(index.get("inner")?.block.layout).toEqual({ x: 40, y: 40, width: 240, height: 120 })
    expect(index.get("child")?.pageRect).toEqual({ x: 216, y: 224, width: 96, height: 32 })
  })

  test("keeps untouched siblings identical by reference", () => {
    const blocks = nestedFixture()

    const next = updateRects(
      buildIndex(blocks),
      new Map([["sibling", { x: 320, y: 160, width: 160, height: 96 }]])
    )

    expect(next[0]).toBe(blocks[0])
  })
})

describe("index ancestry helpers", () => {
  test("resolves the top-level ancestor for nested and top-level ids", () => {
    const index = buildIndex(nestedFixture())

    expect(topLevelAncestorOf(index, "child")).toBe("outer")
    expect(topLevelAncestorOf(index, "outer")).toBe("outer")
    expect(topLevelAncestorOf(index, "missing")).toBeNull()
  })

  test("walks the ancestor chain from the block itself up to the top level", () => {
    const index = buildIndex(nestedFixture())

    expect(ancestorChainOf(index, "child")).toEqual(["child", "inner", "outer"])
    expect(ancestorChainOf(index, "sibling")).toEqual(["sibling"])
  })
})

describe("collectResizeMemberIds", () => {
  test("resolves a sole frame target to only its own id, leaving children out of the scale set", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 0, y: 0, width: 96, height: 32 } })
    const frame = makeFrameBlock({ id: "frame", children: [child] })
    const index = buildIndex([frame])

    expect(collectResizeMemberIds(index, ["frame"])).toEqual(["frame"])
  })

  test("flattens a sole group target into itself plus its full descendant subtree", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 0, y: 0, width: 96, height: 32 } })
    const group = makeGroupBlock({ id: "group", children: [child] })
    const index = buildIndex([group])

    expect(collectResizeMemberIds(index, ["group"]).sort()).toEqual(["child", "group"])
  })

  test("flattens a multi-selection into every target plus each target's own descendants", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 0, y: 0, width: 96, height: 32 } })
    const frame = makeFrameBlock({ id: "frame", children: [child] })
    const leaf = makeShapeBlock({ id: "leaf", layout: { x: 600, y: 0 } })
    const index = buildIndex([frame, leaf])

    expect(collectResizeMemberIds(index, ["frame", "leaf"]).sort()).toEqual([
      "child",
      "frame",
      "leaf"
    ])
  })
})

describe("descendInto", () => {
  test("returns the topmost (last) child of a frame", () => {
    const first = makeTextBlock({ id: "a" })
    const second = makeShapeBlock({ id: "b" })
    const frame = makeFrameBlock({ id: "frame", children: [first, second] })
    const index = buildIndex([frame])

    expect(descendInto(index, "frame")).toBe("b")
  })

  test("returns null for a leaf, an empty frame, or an unknown id", () => {
    const emptyFrame = makeFrameBlock({ id: "empty", children: [] })
    const leaf = makeShapeBlock({ id: "leaf" })
    const index = buildIndex([emptyFrame, leaf])

    expect(descendInto(index, "empty")).toBeNull()
    expect(descendInto(index, "leaf")).toBeNull()
    expect(descendInto(index, "missing")).toBeNull()
  })
})
