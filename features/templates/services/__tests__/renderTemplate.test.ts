import { describe, expect, test } from "vitest"

import { type Block } from "../../schemas"
import { addBlock, createBlock } from "../blocks"
import { getContentBounds, DEFAULT_PAGE_SETTINGS } from "../canvasLayout"
import { buildSampleRenderData, type TemplateRenderData } from "../mergeVariables"
import { renderBlockContent, renderTemplate, BUSINESS_LOGO_ASSET_KEY } from "../renderTemplate"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function renderData(values: Record<string, unknown> = {}): TemplateRenderData {
  return { values }
}

function textAt(html: string, layout: Block["layout"]): Block {
  const block = createBlock("text", bounds)

  return block.type === "text" ? { ...block, content: { html }, layout } : block
}

function rotatedText(html: string, layout: Block["layout"], rotation: number): Block {
  const block = textAt(html, layout)

  return block.type === "group" ? block : { ...block, rotation }
}

describe("renderTemplate html output", () => {
  test("emits a relatively positioned page at least one A4 page tall", () => {
    const { blocks } = addBlock([], "text", bounds)

    const html = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("position:relative")
    expect(html).toContain("width:794px")
    expect(html).toContain("height:1123px")
  })

  test("positions every block absolutely at its rectangle offset by the margins", () => {
    const blocks = [textAt("Hello", { x: 96, y: 160, width: 240, height: 32 })]

    const html = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("position:absolute")
    expect(html).toContain("left:128px")
    expect(html).toContain("top:192px")
    expect(html).toContain("width:240px")
    expect(html).toContain("height:32px")
  })

  test("the page grows with the lowest visible block", () => {
    const blocks = [textAt("Deep", { x: 0, y: 1600, width: 240, height: 200 })]

    const html = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("height:1864px")
  })

  test("skips hidden blocks in every format", () => {
    const blocks = [{ ...textAt("HIDDEN", { x: 0, y: 0, width: 240, height: 32 }), hidden: true }]

    const html = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })
    const text = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "text",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).not.toContain("HIDDEN")
    expect(text).not.toContain("HIDDEN")
  })

  test("substitutes only whitelisted identifiers and escapes merge values", () => {
    const blocks = [
      textAt("<p>{{client.name}} {{secret.apiKey}}</p>", { x: 0, y: 0, width: 240, height: 32 })
    ]

    const html = renderTemplate({
      blocks,
      renderData: renderData({ "client.name": '<img src=x onerror="alert(1)">' }),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("&lt;img src=x onerror=")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("secret.apiKey")
  })

  test("emits transform:rotate for a rotated block and survives the sanitize pass", () => {
    const rotated = rotatedText("Turned", { x: 96, y: 160, width: 240, height: 32 }, 45.5)

    const html = renderTemplate({
      blocks: [rotated],
      renderData: renderData(),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("transform:rotate(45.5deg)")
  })

  test("emits transform:rotate for a rotated frame child", () => {
    const { blocks } = addBlock([], "frame", bounds)
    const frame = blocks[0]

    if (frame?.type !== "frame") throw new Error("expected a frame")

    const child = rotatedText("Nested", { x: 8, y: 8, width: 120, height: 24 }, 90)
    const withChild: Block[] = [{ ...frame, content: { ...frame.content, children: [child] } }]

    const html = renderTemplate({
      blocks: withChild,
      renderData: renderData(),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("transform:rotate(90deg)")
  })

  test("a rotation-free document renders byte-identically with no transform emission", () => {
    const blocks = [textAt("Plain", { x: 96, y: 160, width: 240, height: 32 })]

    const input = {
      blocks,
      renderData: renderData(),
      type: "invoice" as const,
      format: "html" as const,
      pageSettings: DEFAULT_PAGE_SETTINGS
    }

    const html = renderTemplate(input)
    const htmlWithZero = renderTemplate({
      ...input,
      blocks: blocks.map((block) => (block.type === "group" ? block : { ...block, rotation: 0 }))
    })

    expect(html).not.toContain("transform")
    expect(htmlWithZero).toBe(html)
    expect(html).toMatchInlineSnapshot(`
      "<div style="position:relative;width:794px;height:1123px;font-family:'DM Sans', system-ui, sans-serif;font-size:14px;color:#0f172a;background-color:#ffffff">
      <div style="position:absolute;left:128px;top:192px;width:240px;height:32px"><div>Plain</div></div>
      </div>"
    `)
  })

  test("email templates render the same absolute page at 600px", () => {
    const { blocks } = addBlock([], "text", bounds)

    const html = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "email_invoice_send",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("width:600px")
    expect(html).toContain("position:relative")
  })
})

describe("renderTemplate table output", () => {
  function makeTable(content: Extract<Block, { type: "table" }>["content"]): Block {
    const block = createBlock("table", bounds)

    return block.type === "table" ? { ...block, content } : block
  }

  test("renders manual rows with escaped, substituted cells", () => {
    const blocks = [
      makeTable({
        source: "manual",
        columns: [{ id: "c1", header: "Item <b>", width: 200, binding: null }],
        rows: [{ id: "r1", cells: ["{{invoice.number}} & more"] }]
      })
    ]

    const html = renderTemplate({
      blocks,
      renderData: renderData({ "invoice.number": "INV-42" }),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("border-collapse:collapse")
    expect(html).toContain("Item &lt;b&gt;")
    expect(html).toContain("width:200px")
    expect(html).toContain("INV-42 &amp; more")
  })

  test("fills a line-items table from the render data's collection", () => {
    const blocks = [
      makeTable({
        source: "lineItems",
        columns: [
          { id: "c1", header: "Description", width: null, binding: "lineItem.description" },
          { id: "c2", header: "Total", width: null, binding: "lineItem.total" }
        ],
        rows: []
      })
    ]

    const html = renderTemplate({
      blocks,
      renderData: {
        values: {},
        lineItems: [
          { "lineItem.description": "Design work", "lineItem.total": "€1,000.00" },
          { "lineItem.description": "Hosting", "lineItem.total": "€50.00" }
        ]
      },
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("Design work")
    expect(html).toContain("Hosting")
    expect(html).toContain("€1,000.00")
  })

  test("the editor sample data fills a bound table with three preview rows", () => {
    const blocks = [
      makeTable({
        source: "lineItems",
        columns: [
          { id: "c1", header: "Description", width: null, binding: "lineItem.description" }
        ],
        rows: []
      })
    ]

    const html = renderTemplate({
      blocks,
      renderData: buildSampleRenderData("invoice"),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html.match(/\[lineItem\.description\]/g)).toHaveLength(3)
  })
})

describe("renderTemplate frame output", () => {
  test("renders the frame as a relative fill with absolutely positioned children", () => {
    const frame = createBlock("frame", bounds)
    const child = createBlock("text", bounds)

    if (frame.type !== "frame" || child.type !== "text") throw new Error("expected frame and text")

    const blocks: Block[] = [
      {
        ...frame,
        content: {
          clip: false,
          children: [
            {
              ...child,
              content: { html: "Right side" },
              layout: { x: 24, y: 16, width: 240, height: 80 }
            }
          ]
        }
      }
    ]

    const html = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("position:relative")
    expect(html).toContain("position:absolute")
    expect(html).toContain("left:24px")
    expect(html).toContain("top:16px")
    expect(html).toContain("Right side")
  })

  test("clips overflowing children only when clip is enabled", () => {
    const frame = createBlock("frame", bounds)
    const child = createBlock("text", bounds)

    if (frame.type !== "frame" || child.type !== "text") throw new Error("expected frame and text")

    const clipped = renderBlockContent(
      {
        ...frame,
        content: {
          clip: true,
          children: [
            {
              ...child,
              content: { html: "Inside" },
              layout: { x: 0, y: 0, width: 240, height: 32 }
            }
          ]
        }
      },
      { renderData: renderData(), type: "invoice" }
    )
    const unclipped = renderBlockContent(
      {
        ...frame,
        content: {
          clip: false,
          children: [
            {
              ...child,
              content: { html: "Inside" },
              layout: { x: 0, y: 0, width: 240, height: 32 }
            }
          ]
        }
      },
      { renderData: renderData(), type: "invoice" }
    )

    expect(clipped).toContain("overflow:hidden")
    expect(unclipped).not.toContain("overflow:hidden")
  })

  test("renders a nested frame as nested relative containers", () => {
    const frame = createBlock("frame", bounds)
    const image = createBlock("image", bounds)
    const inner = createBlock("frame", bounds)
    const text1 = createBlock("text", bounds)
    const text2 = createBlock("text", bounds)

    if (
      frame.type !== "frame" ||
      inner.type !== "frame" ||
      image.type !== "image" ||
      text1.type !== "text" ||
      text2.type !== "text"
    ) {
      throw new Error("expected the requested block types")
    }

    const html = renderBlockContent(
      {
        ...frame,
        content: {
          clip: false,
          children: [
            { ...image, layout: { x: 0, y: 0, width: 96, height: 96 } },
            {
              ...inner,
              layout: { x: 96, y: 0, width: 240, height: 96 },
              content: {
                clip: false,
                children: [
                  {
                    ...text1,
                    content: { html: "Line one" },
                    layout: { x: 0, y: 0, width: 240, height: 32 }
                  },
                  {
                    ...text2,
                    content: { html: "Line two" },
                    layout: { x: 0, y: 40, width: 240, height: 32 }
                  }
                ]
              }
            }
          ]
        }
      },
      { renderData: renderData(), type: "invoice" }
    )

    expect((html.match(/position:relative/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(html).toContain("Line one")
    expect(html).toContain("Line two")
  })
})

describe("renderTemplate shape output", () => {
  function shapeAt(variant: "rectangle" | "ellipse" | "line", layout: Block["layout"]): Block {
    const block = createBlock("shape", bounds)

    return block.type === "shape"
      ? { ...block, content: { variant }, layout, style: { backgroundColor: "#f8fafc" } }
      : block
  }

  test("renders a single 100%-fill div carrying the block's style", () => {
    const blocks = [shapeAt("rectangle", { x: 0, y: 0, width: 160, height: 96 })]

    const html = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("width:100%")
    expect(html).toContain("height:100%")
    expect(html).toContain("background-color:#f8fafc")
    expect((html.match(/background-color:#f8fafc/g) ?? []).length).toBe(1)
  })

  test("an ellipse forces border-radius:50% on its fill div", () => {
    const blocks = [shapeAt("ellipse", { x: 0, y: 0, width: 120, height: 120 })]

    const html = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(html).toContain("border-radius:50%")
  })

  test("produces no text output", () => {
    const blocks = [shapeAt("line", { x: 0, y: 0, width: 240, height: 8 })]

    const text = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "text",
      pageSettings: DEFAULT_PAGE_SETTINGS
    })

    expect(text).toBe("")
  })
})

describe("renderTemplate image sources", () => {
  test("resolves the business logo through its reserved assets key", () => {
    const image = createBlock("image", bounds)

    const blocks: Block[] =
      image.type === "image"
        ? [{ ...image, content: { source: "businessLogo", uploadId: null, alt: "Logo" } }]
        : []

    const html = renderTemplate({
      blocks,
      renderData: renderData(),
      type: "invoice",
      format: "html",
      pageSettings: DEFAULT_PAGE_SETTINGS,
      assets: { [BUSINESS_LOGO_ASSET_KEY]: "https://storage.local/logo.png" }
    })

    expect(html).toContain('src="https://storage.local/logo.png"')
  })
})

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
})

describe("renderBlockContent", () => {
  test("wraps content with the block's style css for the canvas", () => {
    const text = createBlock("text", bounds)

    const styled: Block =
      text.type === "text"
        ? { ...text, content: { html: "Hi" }, style: { backgroundColor: "#f8fafc" } }
        : text

    const html = renderBlockContent(styled, { renderData: renderData(), type: "invoice" })

    expect(html).toContain("background-color:#f8fafc")
    expect(html).toContain("Hi")
  })

  test("still strips scripts and event handlers as the last line of defense", () => {
    const text = createBlock("text", bounds)

    const dirty: Block =
      text.type === "text"
        ? { ...text, content: { html: '<p onclick="x()">Hi</p><script>alert(1)</script>' } }
        : text

    const html = renderBlockContent(dirty, { renderData: renderData(), type: "invoice" })

    expect(html).toContain("<p>Hi</p>")
    expect(html).not.toContain("onclick")
    expect(html).not.toContain("<script")
  })

  test("strips absolute positioning that authored content tries to smuggle in", () => {
    const text = createBlock("text", bounds)

    const dirty: Block =
      text.type === "text"
        ? { ...text, content: { html: '<p style="position:fixed;left:0">Hi</p>' } }
        : text

    const html = renderBlockContent(dirty, { renderData: renderData(), type: "invoice" })

    expect(html).not.toContain("position:fixed")
  })
})
