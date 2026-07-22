import { describe, expect, test } from "vitest"

import { storedBlocksSchema, type StoredBlock } from "../../schemas"
import { getContentBounds, overlaps, DEFAULT_PAGE_SETTINGS } from "../canvasLayout"
import { normalizeBlocks } from "../normalizeBlocks"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function expectNoOverlap(
  blocks: readonly { id: string; layout: { x: number; y: number; width: number; height: number } }[]
) {
  for (const first of blocks) {
    for (const second of blocks) {
      if (first.id === second.id) continue

      expect(overlaps(first.layout, second.layout)).toBe(false)
    }
  }
}

describe("normalizeBlocks", () => {
  test("stacks constrained-flow rows vertically at full row width", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "text",
        layout: { row: 0, column: 0, width: null, height: null },
        content: { html: "first" }
      },
      {
        id: "b",
        type: "text",
        layout: { row: 1, column: 0, width: null, height: null },
        content: { html: "second" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks[0]?.layout).toEqual({ x: 0, y: 0, width: bounds.width, height: 32 })
    expect(blocks[1]?.layout.y).toBe(40)
    expectNoOverlap(blocks)
  })

  test("keeps side-by-side flow columns as horizontal offsets", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "text",
        layout: { row: 0, column: 0, width: 200, height: 48 },
        content: { html: "left" }
      },
      {
        id: "b",
        type: "text",
        layout: { row: 0, column: 1, width: null, height: 48 },
        content: { html: "right" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks[0]?.layout.x).toBe(0)
    expect(blocks[0]?.layout.width).toBe(200)
    expect(blocks[1]?.layout.x).toBe(216)
    expect(blocks[1]?.layout.y).toBe(0)
    expectNoOverlap(blocks)
  })

  test("maps legacy freeform frames near-directly, quantized to the grid", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "text",
        frame: { x: 101, y: 53, width: 199, height: 62 },
        content: { html: "framed" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks[0]?.layout).toEqual({ x: 104, y: 56, width: 200, height: 64 })
  })

  test("keeps overlapping legacy frames without dropping blocks", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "text",
        frame: { x: 0, y: 0, width: 200, height: 100 },
        content: { html: "under" }
      },
      {
        id: "b",
        type: "text",
        frame: { x: 50, y: 50, width: 200, height: 100 },
        content: { html: "over" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks).toHaveLength(2)
    expect(blocks.map((block) => block.id)).toEqual(["a", "b"])
  })

  test("stacks original list rows in array order", () => {
    const stored: StoredBlock[] = [
      { id: "a", type: "text", content: { html: "first" } },
      { id: "b", type: "text", content: { html: "second" } }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks[0]?.layout.y).toBe(0)
    expect(blocks[1]?.layout.y).toBeGreaterThan(0)
    expectNoOverlap(blocks)
  })

  test("migrates a heading to a text block preserving the string as escaped html", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "heading",
        layout: { row: 0, column: 0, width: null, height: null },
        content: { text: "Total <due> & owing", level: 1 }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const block = blocks[0]

    if (block?.type !== "text") throw new Error("expected a text block")

    expect(block.content.html).toBe("Total &lt;due&gt; &amp; owing")
    expect(block.style?.fontSize).toBe(28)
    expect(block.style?.fontWeight).toBe("700")
  })

  test("keeps authored heading style over the level approximation", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "heading",
        layout: { row: 0, column: 0, width: null, height: null },
        content: { text: "Styled", level: 2 },
        style: { fontSize: 40 }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const block = blocks[0]

    if (block?.type !== "text") throw new Error("expected a text block")

    expect(block.style?.fontSize).toBe(40)
    expect(block.style?.fontWeight).toBe("600")
  })

  test("maps a structured header to a text block and drops toggle-only types", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "header",
        layout: { slot: "header", row: 0, column: 0 },
        content: { title: "ACME Invoice" }
      },
      { id: "b", type: "totals", layout: { row: 1, column: 0 }, content: {} }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const block = blocks[0]

    expect(blocks).toHaveLength(1)

    if (block?.type !== "text") throw new Error("expected a text block")

    expect(block.content.html).toBe("ACME Invoice")
  })

  test("defaults legacy image content to the upload source", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "image",
        layout: { row: 0, column: 0, width: null, height: 160 },
        content: { uploadId: null, alt: "logo" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const block = blocks[0]

    if (block?.type !== "image") throw new Error("expected an image block")

    expect(block.content.source).toBe("upload")
  })

  test("migrates a stored box to a frame with its flex children laid out absolutely", () => {
    const stored: StoredBlock[] = [
      {
        id: "box1",
        type: "box",
        layout: { x: 0, y: 0, width: 480, height: 120 },
        content: {
          direction: "row",
          justify: "start",
          align: "start",
          gap: 16,
          children: [
            {
              id: "c1",
              type: "text",
              layout: { x: 0, y: 0, width: 200, height: 32 },
              hidden: false,
              locked: false,
              content: { html: "A" }
            },
            {
              id: "c2",
              type: "image",
              layout: { x: 0, y: 0, width: 96, height: 96 },
              hidden: false,
              locked: false,
              content: { source: "upload", uploadId: null, alt: "logo" }
            }
          ]
        }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const frame = blocks[0]

    if (frame?.type !== "frame") throw new Error("expected a frame block")

    expect(frame.content.clip).toBe(false)
    expect(frame.content.children).toHaveLength(2)
    expect(frame.content.children[0]?.layout.x).toBe(0)
    expect(frame.content.children[1]?.layout.x).toBe(216)

    const first = frame.content.children[0]
    const second = frame.content.children[1]

    if (first?.type !== "text" || second?.type !== "image") {
      throw new Error("expected the box children preserved by type")
    }

    expect(first.content.html).toBe("A")
    expect(second.content.alt).toBe("logo")
  })

  test("migrates a divider to a line shape and drops spacers", () => {
    const stored: StoredBlock[] = [
      {
        id: "d",
        type: "divider",
        layout: { x: 0, y: 0, width: 240, height: 16 },
        content: {}
      },
      {
        id: "s",
        type: "spacer",
        layout: { x: 0, y: 24, width: 96, height: 32 },
        content: { size: "md" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks).toHaveLength(1)

    const shape = blocks[0]

    if (shape?.type !== "shape") throw new Error("expected a line shape from the divider")

    expect(shape.content.variant).toBe("line")
    expect(shape.style?.backgroundColor).toBe("#e2e8f0")
  })

  test("passes absolute rows through quantized and clamped", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "text",
        layout: { x: 800, y: 16, width: 96, height: 32 },
        content: { html: "clamped" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const block = blocks[0]

    if (!block) throw new Error("expected a block")

    expect(block.layout.x + block.layout.width).toBeLessThanOrEqual(bounds.width)
    expect(block.layout.y).toBe(16)
  })

  test("round-trips a stored block's rotation through normalization", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "text",
        layout: { x: 0, y: 0, width: 96, height: 32 },
        rotation: 45,
        content: { html: "tilted" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const block = blocks[0]

    if (block?.type !== "text") throw new Error("expected a text block")

    expect(block.rotation).toBe(45)
  })

  test("re-quantizes an over-precision stored rotation so it stays renderable", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "text",
        layout: { x: 0, y: 0, width: 96, height: 32 },
        rotation: 45.12345,
        content: { html: "tilted" }
      },
      {
        id: "b",
        type: "text",
        layout: { x: 0, y: 64, width: 96, height: 32 },
        rotation: 359.99,
        content: { html: "nearly full turn" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const [first, second] = blocks

    if (first?.type !== "text" || second?.type !== "text") throw new Error("expected text blocks")

    expect(first.rotation).toBe(45.1)
    expect(second.rotation).toBe(0)
  })

  test("leaves rotation absent when the stored block carries none, so readers default it to 0", () => {
    const stored: StoredBlock[] = [
      {
        id: "a",
        type: "text",
        layout: { x: 0, y: 0, width: 96, height: 32 },
        content: { html: "plain" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const block = blocks[0]

    if (block?.type !== "text") throw new Error("expected a text block")

    expect("rotation" in block).toBe(false)
  })

  test("round-trips rotation on a nested frame child", () => {
    const stored: StoredBlock[] = [
      {
        id: "frame1",
        type: "frame",
        layout: { x: 0, y: 0, width: 480, height: 240 },
        content: {
          clip: false,
          children: [
            {
              id: "c1",
              type: "shape",
              layout: { x: 16, y: 16, width: 96, height: 96 },
              rotation: 30,
              hidden: false,
              locked: false,
              content: { variant: "rectangle" }
            }
          ]
        }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const frame = blocks[0]

    if (frame?.type !== "frame") throw new Error("expected a frame block")

    const child = frame.content.children[0]

    if (child?.type !== "shape") throw new Error("expected a shape child")

    expect(child.rotation).toBe(30)
  })

  test("drops a stored group's own rotation while keeping a rotated member's", () => {
    const stored: StoredBlock[] = [
      {
        id: "g1",
        type: "group",
        rotation: 45,
        content: {
          children: [
            {
              id: "m1",
              type: "shape",
              layout: { x: 0, y: 0, width: 96, height: 96 },
              rotation: 15,
              hidden: false,
              locked: false,
              content: { variant: "rectangle" }
            }
          ]
        }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const group = blocks[0]

    if (group?.type !== "group") throw new Error("expected a group block")

    const member = group.content.children[0]

    if (member?.type !== "shape") throw new Error("expected a shape member")

    expect("rotation" in group).toBe(false)
    expect(member.rotation).toBe(15)
  })

  test("rejects a stored rotation outside [0, 360) at the read-schema backstop", () => {
    const base = {
      id: "a",
      type: "text" as const,
      layout: { x: 0, y: 0, width: 96, height: 32 },
      content: { html: "tilted" }
    }

    expect(storedBlocksSchema.safeParse([{ ...base, rotation: 360 }]).success).toBe(false)
    expect(storedBlocksSchema.safeParse([{ ...base, rotation: -1 }]).success).toBe(false)
    expect(storedBlocksSchema.safeParse([{ ...base, rotation: 359.5 }]).success).toBe(true)
  })
})
