import { describe, expect, test } from "vitest"

import { makeFrameBlock, makeShapeBlock, makeTextBlock } from "@/tests/factories/blocks"

import { buildIndex } from "../blockIndex"
import { blocksInMarquee, deepestAt, hitTestBlocks, topLevelAncestorAt } from "../hitTest"

describe("hitTestBlocks", () => {
  test("returns ids under the point topmost first by sibling z-order", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "below", layout: { x: 0, y: 0, width: 200, height: 200 } }),
      makeShapeBlock({ id: "above", layout: { x: 50, y: 50, width: 200, height: 200 } })
    ])

    expect(hitTestBlocks(index, { x: 100, y: 100 })).toEqual(["above", "below"])
    expect(hitTestBlocks(index, { x: 10, y: 10 })).toEqual(["below"])
  })

  test("returns an empty list when nothing is under the point", () => {
    const index = buildIndex([makeShapeBlock({ id: "only", layout: { x: 0, y: 0 } })])

    expect(hitTestBlocks(index, { x: 500, y: 500 })).toEqual([])
  })

  test("lists a frame child above its frame", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 80, y: 80 }, children: [child] })
    ])

    expect(hitTestBlocks(index, { x: 100, y: 100 })).toEqual(["child", "frame"])
  })

  test("hits an overflowing child of a non-clipping frame outside the frame box", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 500, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({
        id: "frame",
        layout: { x: 0, y: 0, width: 480, height: 240 },
        clip: false,
        children: [child]
      })
    ])

    expect(hitTestBlocks(index, { x: 540, y: 30 })).toEqual(["child"])
  })

  test("ignores an overflowing child when the frame clips its contents", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 500, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({
        id: "frame",
        layout: { x: 0, y: 0, width: 480, height: 240 },
        clip: true,
        children: [child]
      })
    ])

    expect(hitTestBlocks(index, { x: 540, y: 30 })).toEqual([])
  })

  test("excludes hidden blocks and their subtrees", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 0, y: 0 }, hidden: true, children: [child] })
    ])

    expect(hitTestBlocks(index, { x: 20, y: 20 })).toEqual([])
  })

  test("excludes locked blocks unless includeLocked is set", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "locked", layout: { x: 0, y: 0 }, locked: true })
    ])

    expect(hitTestBlocks(index, { x: 10, y: 10 })).toEqual([])
    expect(hitTestBlocks(index, { x: 10, y: 10 }, { includeLocked: true })).toEqual(["locked"])
  })

  test("hits a rotated block where it is painted, not at its unrotated footprint", () => {
    const index = buildIndex([
      makeShapeBlock({
        id: "rotated",
        layout: { x: 0, y: 0, width: 160, height: 80 },
        rotation: 90
      })
    ])

    expect(hitTestBlocks(index, { x: 100, y: 100 })).toEqual(["rotated"])
    expect(hitTestBlocks(index, { x: 10, y: 10 })).toEqual([])
  })
})

describe("blocksInMarquee", () => {
  function nestedIndex() {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 0, y: 0, width: 480, height: 240 },
      children: [child]
    })
    const loose = makeShapeBlock({ id: "loose", layout: { x: 600, y: 0, width: 96, height: 96 } })

    return buildIndex([frame, loose])
  }

  test("catches only top-level blocks intersecting the rect by default", () => {
    const index = nestedIndex()

    const caught = blocksInMarquee(
      index,
      { x: 0, y: 0, width: 700, height: 200 },
      { nested: false }
    )

    expect(caught.toSorted()).toEqual(["frame", "loose"])
  })

  test("catches the deepest intersecting nodes in nested mode", () => {
    const index = nestedIndex()

    const caught = blocksInMarquee(index, { x: 8, y: 8, width: 60, height: 60 }, { nested: true })

    expect(caught).toEqual(["child"])
  })

  test("keeps a container in nested mode when none of its descendants intersect", () => {
    const index = nestedIndex()

    const caught = blocksInMarquee(
      index,
      { x: 200, y: 100, width: 100, height: 100 },
      { nested: true }
    )

    expect(caught).toEqual(["frame"])
  })

  test("excludes locked and hidden blocks", () => {
    const index = buildIndex([
      makeShapeBlock({ id: "locked", layout: { x: 0, y: 0 }, locked: true }),
      makeShapeBlock({ id: "hidden", layout: { x: 0, y: 200 }, hidden: true }),
      makeShapeBlock({ id: "plain", layout: { x: 0, y: 400 } })
    ])

    const caught = blocksInMarquee(
      index,
      { x: 0, y: 0, width: 700, height: 600 },
      { nested: false }
    )

    expect(caught).toEqual(["plain"])
  })

  test("excludes children of a hidden container in nested mode", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const frame = makeFrameBlock({
      id: "frame",
      layout: { x: 0, y: 0, width: 480, height: 240 },
      children: [child],
      hidden: true
    })
    const index = buildIndex([frame])

    const caught = blocksInMarquee(index, { x: 0, y: 0, width: 480, height: 240 }, { nested: true })

    expect(caught).toEqual([])
  })

  test("returns an empty list when the rect misses every block", () => {
    const index = nestedIndex()

    expect(
      blocksInMarquee(index, { x: 1000, y: 1000, width: 50, height: 50 }, { nested: false })
    ).toEqual([])
  })

  test("catches a rotated block by its painted shape, not its unrotated footprint", () => {
    const index = buildIndex([
      makeShapeBlock({
        id: "diamond",
        layout: { x: 0, y: 0, width: 100, height: 100 },
        rotation: 45
      })
    ])

    const missesTheCorner = blocksInMarquee(
      index,
      { x: 0, y: 0, width: 10, height: 10 },
      { nested: false }
    )
    const crossesTheShape = blocksInMarquee(
      index,
      { x: 40, y: 40, width: 20, height: 20 },
      { nested: false }
    )

    expect(missesTheCorner).toEqual([])
    expect(crossesTheShape).toEqual(["diamond"])
  })
})

describe("deepestAt and topLevelAncestorAt", () => {
  test("resolve the deepest hit and its top-level ancestor", () => {
    const child = makeTextBlock({ id: "child", layout: { x: 16, y: 16, width: 96, height: 32 } })
    const index = buildIndex([
      makeFrameBlock({ id: "frame", layout: { x: 80, y: 80 }, children: [child] })
    ])

    expect(deepestAt(index, { x: 100, y: 100 })).toBe("child")
    expect(topLevelAncestorAt(index, { x: 100, y: 100 })).toBe("frame")
  })

  test("return null over empty canvas", () => {
    const index = buildIndex([])

    expect(deepestAt(index, { x: 10, y: 10 })).toBeNull()
    expect(topLevelAncestorAt(index, { x: 10, y: 10 })).toBeNull()
  })
})
