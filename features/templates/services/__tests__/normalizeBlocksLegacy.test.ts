import { describe, expect, test } from "vitest"

import { type StoredBlock } from "../../schemas"
import { CHILD_NATURAL_SIZES, NATURAL_HEIGHTS, NATURAL_WIDTHS } from "../blocks"
import { DEFAULT_PAGE_SETTINGS } from "../canvasLayout"
import { normalizeBlocks } from "../normalizeBlocks"

describe("normalizeBlocks legacy shapes", () => {
  test("drops a structured header whose title is blank or missing", () => {
    const stored: StoredBlock[] = [
      {
        id: "blank",
        type: "header",
        layout: { slot: "header", row: 0, column: 0 },
        content: { title: "   " }
      },
      { id: "missing", type: "header", layout: { slot: "header", row: 1, column: 0 }, content: {} }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks).toEqual([])
  })

  test("keeps footer, notes and terms prose as text, footer last, and drops the blank ones", () => {
    const stored: StoredBlock[] = [
      {
        id: "footer",
        type: "footer",
        layout: { slot: "footer", row: 0, column: 0 },
        content: { text: "<p>Thank you</p>" }
      },
      {
        id: "notes",
        type: "notes",
        layout: { row: 0, column: 0 },
        content: { text: "<p>Paid by transfer</p>" }
      },
      { id: "terms", type: "terms", layout: { row: 1, column: 0 }, content: { text: "  " } },
      { id: "empty", type: "notes", layout: { row: 2, column: 0 }, content: {} }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks.map((block) => block.id)).toEqual(["notes", "footer"])
    expect(blocks.map((block) => (block.type === "text" ? block.content.html : null))).toEqual([
      "<p>Paid by transfer</p>",
      "<p>Thank you</p>"
    ])
  })

  test("drops the structured data blocks a document now fills from its own record", () => {
    const stored: StoredBlock[] = [
      { id: "business", type: "business_info", layout: { row: 0, column: 0 }, content: {} },
      { id: "client", type: "client_info", layout: { row: 1, column: 0 }, content: {} },
      { id: "lines", type: "line_items", layout: { row: 2, column: 0 }, content: {} },
      { id: "payment", type: "payment_info", layout: { row: 3, column: 0 }, content: {} },
      { id: "signature", type: "signature", layout: { row: 4, column: 0 }, content: {} }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks).toEqual([])
  })

  test("orders legacy framed rows top to bottom, then left to right", () => {
    const stored: StoredBlock[] = [
      {
        id: "lower",
        type: "text",
        frame: { x: 0, y: 160, width: 160, height: 32 },
        content: { html: "c" }
      },
      {
        id: "right",
        type: "text",
        frame: { x: 320, y: 0, width: 160, height: 32 },
        content: { html: "b" }
      },
      {
        id: "left",
        type: "text",
        frame: { x: 0, y: 0, width: 160, height: 32 },
        content: { html: "a" }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks.map((block) => block.id)).toEqual(["left", "right", "lower"])
  })

  test("sizes an absolute row that stored no size from its type's natural size", () => {
    const stored: StoredBlock[] = [
      { id: "a", type: "text", layout: { x: 16, y: 24 }, content: { html: "unsized" } }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)

    expect(blocks[0]?.layout).toEqual({
      x: 16,
      y: 24,
      width: NATURAL_WIDTHS.text,
      height: NATURAL_HEIGHTS.text
    })
  })

  test("lays a legacy column box's children out top to bottom at its gap", () => {
    const stored: StoredBlock[] = [
      {
        id: "box",
        type: "box",
        layout: { x: 0, y: 0, width: 240, height: 160 },
        content: {
          direction: "column",
          justify: "start",
          align: "start",
          gap: 8,
          children: [
            {
              id: "first",
              type: "text",
              layout: { width: 160, height: 32 },
              content: { html: "1" }
            },
            {
              id: "second",
              type: "text",
              layout: { width: 160, height: 48 },
              content: { html: "2" }
            }
          ]
        }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const frame = blocks[0]

    if (frame?.type !== "frame") throw new Error("expected a frame block")

    expect(frame.content.children.map((child) => [child.layout.x, child.layout.y])).toEqual([
      [0, 0],
      [0, 40]
    ])
  })

  test("drops an unreadable child without losing its readable siblings", () => {
    const stored: StoredBlock[] = [
      {
        id: "frame",
        type: "frame",
        layout: { x: 0, y: 0, width: 480, height: 160 },
        content: {
          children: [
            { id: "broken", type: "hologram" },
            { id: "kept", type: "text", content: { html: "survives" } }
          ]
        }
      },
      {
        id: "box",
        type: "box",
        layout: { x: 0, y: 200, width: 480, height: 160 },
        content: {
          direction: "row",
          justify: "start",
          align: "start",
          gap: 16,
          children: [{ nonsense: true }, { id: "placed", type: "text", content: { html: "x" } }]
        }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const [frame, box] = blocks

    if (frame?.type !== "frame" || box?.type !== "frame") throw new Error("expected two frames")

    expect(frame.content.children.map((child) => child.id)).toEqual(["kept"])
    expect(box.content.children.map((child) => [child.id, child.layout.x])).toEqual([["placed", 0]])
  })

  test("gives a nested child that stored no layout its natural child size at the origin", () => {
    const stored: StoredBlock[] = [
      {
        id: "frame",
        type: "frame",
        layout: { x: 0, y: 0, width: 480, height: 160 },
        content: { children: [{ id: "child", type: "text", content: { html: "unsized" } }] }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const frame = blocks[0]

    if (frame?.type !== "frame") throw new Error("expected a frame block")

    expect(frame.content.children[0]?.layout).toEqual({ x: 0, y: 0, ...CHILD_NATURAL_SIZES.text })
  })

  test("keeps a named group nested in a frame and drops one with no readable members", () => {
    const stored: StoredBlock[] = [
      {
        id: "frame",
        type: "frame",
        layout: { x: 0, y: 0, width: 480, height: 240 },
        content: {
          clip: true,
          children: [
            {
              id: "lockup",
              type: "group",
              name: "Logo lockup",
              content: {
                children: [{ id: "mark", type: "text", content: { html: "Acme" } }]
              }
            },
            { id: "hollow", type: "group", content: { children: [{ id: "x", type: "void" }] } }
          ]
        }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const frame = blocks[0]

    if (frame?.type !== "frame") throw new Error("expected a frame block")

    const [group] = frame.content.children

    expect(frame.content.clip).toBe(true)
    expect(frame.content.children).toHaveLength(1)
    expect(group?.type).toBe("group")
    expect(group?.name).toBe("Logo lockup")
  })

  test("carries a nested frame's name, style and visibility flags", () => {
    const stored: StoredBlock[] = [
      {
        id: "outer",
        type: "frame",
        layout: { x: 0, y: 0, width: 480, height: 240 },
        content: {
          children: [
            {
              id: "inner",
              type: "frame",
              name: "Totals panel",
              hidden: true,
              locked: true,
              style: { backgroundColor: "#f8fafc" },
              content: { children: [] }
            }
          ]
        }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const outer = blocks[0]

    if (outer?.type !== "frame") throw new Error("expected a frame block")

    expect(outer.content.children[0]).toMatchObject({
      id: "inner",
      type: "frame",
      name: "Totals panel",
      hidden: true,
      locked: true,
      style: { backgroundColor: "#f8fafc" },
      content: { clip: false, children: [] }
    })
  })

  test("drops containers nested deeper than the frame depth limit", () => {
    const stored: StoredBlock[] = [
      {
        id: "outer",
        type: "frame",
        layout: { x: 0, y: 0, width: 480, height: 240 },
        content: {
          children: [
            {
              id: "middle",
              type: "frame",
              content: {
                children: [
                  { id: "too-deep-frame", type: "frame", content: { children: [] } },
                  {
                    id: "too-deep-group",
                    type: "group",
                    content: { children: [{ id: "g", type: "text", content: { html: "g" } }] }
                  },
                  { id: "leaf", type: "text", content: { html: "leaf" } }
                ]
              }
            }
          ]
        }
      }
    ]

    const blocks = normalizeBlocks(stored, "invoice", DEFAULT_PAGE_SETTINGS)
    const outer = blocks[0]
    const middle = outer?.type === "frame" ? outer.content.children[0] : undefined

    if (middle?.type !== "frame") throw new Error("expected the middle frame to survive")

    expect(middle.content.children.map((child) => child.id)).toEqual(["leaf"])
  })
})
