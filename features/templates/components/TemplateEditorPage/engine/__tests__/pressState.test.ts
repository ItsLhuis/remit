import { describe, expect, test } from "vitest"

import {
  clearNodeTransforms,
  composeTransform,
  handleDirectionAt,
  isRotateZoneTarget,
  isTextEditSurfaceTarget,
  pastThreshold,
  rectsEqual,
  restoreNodeRects
} from "../pressState"

describe("composeTransform", () => {
  test("returns an empty string when there is no translation or rotation", () => {
    expect(composeTransform(0, 0, 0)).toBe("")
  })

  test("composes only the translation when rotation is zero", () => {
    expect(composeTransform(12, -4, 0)).toBe("translate(12px, -4px)")
  })

  test("composes only the rotation when there is no translation", () => {
    expect(composeTransform(0, 0, 30)).toBe("rotate(30deg)")
  })

  test("composes translation before rotation when both are present", () => {
    expect(composeTransform(12, -4, 30)).toBe("translate(12px, -4px) rotate(30deg)")
  })
})

// Pins the cancellation contract's DOM-write half: a cancelled gesture must clear every in-flight
// inline style immediately, restoring the block's committed rotation (never a bare transform).
describe("clearNodeTransforms", () => {
  test("resets each node's transform to its committed rotation", () => {
    const nodeA = document.createElement("div")
    const nodeB = document.createElement("div")

    nodeA.style.transform = "translate(40px, 10px)"
    nodeB.style.transform = "translate(-8px, 6px) rotate(15deg)"

    const nodes = new Map([
      ["a", nodeA],
      ["b", nodeB]
    ])

    clearNodeTransforms(
      (id) => nodes.get(id) ?? null,
      ["a", "b"],
      (id) => (id === "b" ? 15 : 0)
    )

    expect(nodeA.style.transform).toBe("")
    expect(nodeB.style.transform).toBe("rotate(15deg)")
  })

  test("skips an id with no registered node", () => {
    expect(() =>
      clearNodeTransforms(
        () => null,
        ["missing"],
        () => 0
      )
    ).not.toThrow()
  })
})

describe("restoreNodeRects", () => {
  test("restores each node's pre-gesture transform, width, and height", () => {
    const node = document.createElement("div")

    node.style.transform = "translate(50px, 20px)"
    node.style.width = "300px"
    node.style.height = "150px"

    const baseRects = new Map([["a", { x: 10, y: 10, width: 160, height: 96 }]])

    restoreNodeRects(
      (id) => (id === "a" ? node : null),
      baseRects,
      () => 0
    )

    expect(node.style.transform).toBe("")
    expect(node.style.width).toBe("160px")
    expect(node.style.height).toBe("96px")
  })
})

describe("rectsEqual", () => {
  test("compares every field", () => {
    const rect = { x: 0, y: 0, width: 100, height: 50 }

    expect(rectsEqual(rect, { ...rect })).toBe(true)
    expect(rectsEqual(rect, { ...rect, width: 101 })).toBe(false)
  })
})

describe("pastThreshold", () => {
  test("stays under threshold for a sub-activation-distance move", () => {
    expect(pastThreshold({ x: 100, y: 100 }, { clientX: 102, clientY: 100 })).toBe(false)
  })

  test("crosses the threshold once the pointer travels far enough", () => {
    expect(pastThreshold({ x: 100, y: 100 }, { clientX: 105, clientY: 100 })).toBe(true)
  })
})

describe("handleDirectionAt", () => {
  test("reads the direction off the closest data-resize-handle ancestor", () => {
    const handle = document.createElement("button")

    handle.dataset.resizeHandle = "se"

    const icon = document.createElement("span")

    handle.appendChild(icon)

    expect(handleDirectionAt(icon)).toBe("se")
  })

  test("returns null when the target is not on a resize handle", () => {
    expect(handleDirectionAt(document.createElement("div"))).toBeNull()
  })

  test("returns null for an unrecognized direction value", () => {
    const handle = document.createElement("button")

    handle.dataset.resizeHandle = "north-by-northwest"

    expect(handleDirectionAt(handle)).toBeNull()
  })
})

describe("isRotateZoneTarget", () => {
  test("matches an element inside a rotate zone", () => {
    const zone = document.createElement("button")

    zone.dataset.rotateZone = "nw"

    const child = document.createElement("span")

    zone.appendChild(child)

    expect(isRotateZoneTarget(child)).toBe(true)
  })

  test("does not match an unrelated element", () => {
    expect(isRotateZoneTarget(document.createElement("div"))).toBe(false)
  })
})

describe("isTextEditSurfaceTarget", () => {
  test("matches a contentEditable element", () => {
    const surface = document.createElement("div")

    surface.contentEditable = "true"

    expect(isTextEditSurfaceTarget(surface)).toBe(true)
  })

  test("matches a descendant of the portaled autocomplete surface marker", () => {
    const surface = document.createElement("div")

    surface.dataset.textEditSurface = ""

    const child = document.createElement("span")

    surface.appendChild(child)

    expect(isTextEditSurfaceTarget(child)).toBe(true)
  })

  test("does not match an ordinary element", () => {
    expect(isTextEditSurfaceTarget(document.createElement("div"))).toBe(false)
  })
})
