import { describe, expect, test } from "vitest"

import { type Block } from "../../schemas"
import { createBlock } from "../blocks"
import { getContentBounds, DEFAULT_PAGE_SETTINGS } from "../canvasLayout"
import { type TemplateRenderData } from "../mergeVariables"
import { renderTemplate } from "../renderTemplate"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function renderData(values: Record<string, unknown> = {}): TemplateRenderData {
  return { values }
}

function textAt(html: string, layout: Block["layout"]): Block {
  const block = createBlock("text", bounds)

  return block.type === "text" ? { ...block, content: { html }, layout } : block
}

describe("renderTemplate text format", () => {
  test("flows blocks in array (z) order as plain text without markup", () => {
    const blocks = [
      textAt("<p>Body</p>", { x: 0, y: 100, width: 240, height: 32 }),
      textAt("Title", { x: 0, y: 0, width: 240, height: 32 })
    ]

    const text = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "text",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(text.indexOf("Body")).toBeLessThan(text.indexOf("Title"))
    expect(text).not.toContain("<")
  })

  test("renders an image as its alt text and a shape as nothing", () => {
    const image = createBlock("image", bounds)
    const shape = createBlock("shape", bounds)

    const blocks: Block[] =
      image.type === "image"
        ? [{ ...image, content: { source: "upload", uploadId: null, alt: "Company logo" } }, shape]
        : []

    const text = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "text",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(text).toBe("Company logo")
  })

  test("renders tables as pipe-separated rows, line items drawn from the render data", () => {
    const table = createBlock("table", bounds)

    if (table.type !== "table") throw new Error("expected a table block")

    const blocks: Block[] = [
      {
        ...table,
        content: {
          source: "manual",
          columns: [
            { id: "c1", header: "Term", width: null, binding: null },
            { id: "c2", header: "Detail", width: null, binding: null }
          ],
          rows: [{ id: "r1", cells: ["Due", "{{invoice.number}} in 30 days"] }]
        }
      },
      {
        ...table,
        id: "bound",
        content: {
          source: "lineItems",
          columns: [
            { id: "c1", header: "Item", width: null, binding: "lineItem.description" },
            { id: "c2", header: "Note", width: null, binding: null }
          ],
          rows: []
        }
      }
    ]

    const text = renderTemplate({
      blocks,
      renderData: {
        values: { "invoice.number": "INV-7" },
        lineItems: [{ "lineItem.description": "Hosting" }]
      },
      type: "invoice",
      format: "text",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(text).toBe("Term | Detail\nDue | INV-7 in 30 days\n\nItem | Note\nHosting | ")
  })

  test("renders only the header of a line-items table when the data carries no lines", () => {
    const table = createBlock("table", bounds)

    if (table.type !== "table") throw new Error("expected a table block")

    const blocks: Block[] = [
      {
        ...table,
        content: {
          source: "lineItems",
          columns: [{ id: "c1", header: "Item", width: null, binding: "lineItem.description" }],
          rows: []
        }
      }
    ]

    const text = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "text",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(text).toBe("Item")
  })

  test("renders a frame's visible children one per line and omits hidden and empty ones", () => {
    const frame = createBlock("frame", bounds)
    const shape = createBlock("shape", bounds)

    if (frame.type !== "frame") throw new Error("expected a frame block")

    const blocks: Block[] = [
      {
        ...frame,
        content: {
          clip: false,
          children: [
            textAt("First", { x: 0, y: 0, width: 160, height: 32 }),
            { ...textAt("Secret", { x: 0, y: 40, width: 160, height: 32 }), hidden: true },
            shape,
            textAt("Last", { x: 0, y: 80, width: 160, height: 32 })
          ]
        }
      }
    ]

    const text = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "text",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(text).toBe("First\nLast")
  })
})
