import { eq, isNull } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, templates, uploads } from "@/database/schema"

import { makeTemplate, makeUpload, makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

import { DEFAULT_PAGE_SETTINGS } from "../services"

const pageSettings = DEFAULT_PAGE_SETTINGS

function rect(x: number, y: number, width = 240, height = 32) {
  return { x, y, width, height }
}

const flags = { hidden: false, locked: false }

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000901"
const ownerEmail = "owner-templates@example.com"

describe("template mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("creates a template with an empty block array", async () => {
    const { createTemplate } = await import("../mutations")

    const result = await createTemplate({ name: "Standard invoice", type: "invoice", subject: "" })
    const [row] = await database.select().from(templates)

    expect(result).toEqual({
      data: { template: expect.objectContaining({ name: "Standard invoice", type: "invoice" }) }
    })
    expect(row?.blocks).toEqual([])
  })

  test("persists absolute blocks and page settings that pass every check", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "invoice", name: "Draft" })

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [
        {
          id: "b1",
          type: "text",
          content: { html: "<p>{{invoice.total}}</p>" },
          layout: rect(0, 0),
          ...flags
        }
      ],
      pageSettings: { ...pageSettings, baseFontSize: 16 }
    })
    const [row] = await database.select().from(templates).where(eq(templates.id, template.id))

    expect("data" in result).toBe(true)
    expect(row?.blocks).toEqual([
      {
        id: "b1",
        type: "text",
        content: { html: "<p>{{invoice.total}}</p>" },
        layout: rect(0, 0),
        hidden: false,
        locked: false
      }
    ])
    expect(row?.pageSettings).toMatchObject({ baseFontSize: 16 })
  })

  test("strips script and unsafe markup from text blocks before persisting", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "invoice", name: "Draft" })

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [
        {
          id: "b1",
          type: "text",
          content: { html: '<p onclick="steal()">Hi</p><script>alert(1)</script>' },
          layout: rect(0, 0),
          ...flags
        }
      ],
      pageSettings
    })
    const [row] = await database.select().from(templates).where(eq(templates.id, template.id))
    const html = JSON.stringify(row?.blocks)

    expect("data" in result).toBe(true)
    expect(html).not.toContain("<script")
    expect(html).not.toContain("onclick")
    expect(html).toContain("<p>Hi</p>")
  })

  test("sanitizes text blocks nested inside a frame before persisting", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "invoice", name: "Draft" })

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [
        {
          id: "b1",
          type: "frame",
          content: {
            clip: false,
            children: [
              {
                id: "c1",
                type: "text",
                content: { html: "<p>Hi</p><script>alert(1)</script>" },
                layout: rect(0, 0, 160, 32),
                ...flags
              }
            ]
          },
          layout: rect(0, 0, 480, 120),
          ...flags
        }
      ],
      pageSettings
    })
    const [row] = await database.select().from(templates).where(eq(templates.id, template.id))

    expect("data" in result).toBe(true)
    expect(JSON.stringify(row?.blocks)).not.toContain("<script")
  })

  test("rejects a save that uses a merge variable outside the type whitelist", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "invoice", name: "Draft" })

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [
        {
          id: "b1",
          type: "text",
          content: { html: "{{proposal.total}}" },
          layout: rect(0, 0),
          ...flags
        }
      ],
      pageSettings
    })
    const [row] = await database.select().from(templates).where(eq(templates.id, template.id))

    expect("error" in result && result.error).toContain("proposal.total")
    expect(row?.blocks).toEqual([])
  })

  test("accepts a payload with overlapping rectangles because the model is layered", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "invoice", name: "Draft" })

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [
        { id: "a", type: "text", content: { html: "" }, layout: rect(0, 0), ...flags },
        { id: "b", type: "text", content: { html: "" }, layout: rect(120, 16), ...flags }
      ],
      pageSettings
    })
    const [row] = await database.select().from(templates).where(eq(templates.id, template.id))

    expect("data" in result).toBe(true)
    expect(row?.blocks).toHaveLength(2)
  })

  test("rejects a crafted payload with a block outside the content box", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "invoice", name: "Draft" })

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [{ id: "a", type: "text", content: { html: "" }, layout: rect(688, 0), ...flags }],
      pageSettings
    })
    const [row] = await database.select().from(templates).where(eq(templates.id, template.id))

    expect("error" in result).toBe(true)
    expect(row?.blocks).toEqual([])
  })

  test("rejects a line-items table on a template type without line items", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "contract", name: "Draft" })

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [
        {
          id: "t1",
          type: "table",
          content: {
            source: "lineItems",
            columns: [{ id: "c1", header: "Item", width: null, binding: "lineItem.description" }],
            rows: []
          },
          layout: rect(0, 0, 480, 160),
          ...flags
        }
      ],
      pageSettings
    })

    expect("error" in result).toBe(true)
  })

  test("persists a line-items table on an invoice template", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "invoice", name: "Draft" })

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [
        {
          id: "t1",
          type: "table",
          content: {
            source: "lineItems",
            columns: [
              { id: "c1", header: "Description", width: null, binding: "lineItem.description" },
              { id: "c2", header: "Total", width: 120, binding: "lineItem.total" }
            ],
            rows: []
          },
          layout: rect(0, 0, 480, 160),
          ...flags
        }
      ],
      pageSettings
    })

    expect("data" in result).toBe(true)
  })

  test("rejects a legacy block type on the strict write path", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "invoice", name: "Draft" })

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [{ id: "h1", type: "header", content: { title: "" }, layout: rect(0, 0), ...flags }],
      pageSettings
    })

    expect("error" in result).toBe(true)
  })

  test("moves the default flag to the target template within its type", async () => {
    const { setDefaultTemplate } = await import("../mutations")

    const first = await makeTemplate({ type: "invoice", isDefault: true })
    const second = await makeTemplate({ type: "invoice", isDefault: false })

    const result = await setDefaultTemplate({ id: second.id })
    const rows = await database.select().from(templates)

    expect(result).toEqual({ data: { id: second.id } })
    expect(rows.find((row) => row.id === first.id)?.isDefault).toBe(false)
    expect(rows.find((row) => row.id === second.id)?.isDefault).toBe(true)
  })

  test("soft deletes a non-system template and hides it from the list", async () => {
    const { softDeleteTemplate } = await import("../mutations")
    const { getTemplatesPageData } = await import("../queries")

    const template = await makeTemplate({ name: "Disposable" })

    const result = await softDeleteTemplate({ id: template.id })
    const active = await database.select().from(templates).where(isNull(templates.deletedAt))
    const list = await getTemplatesPageData({})
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({ data: { id: template.id } })
    expect(active).toHaveLength(0)
    expect(list.templates).toHaveLength(0)
    expect(auditRows[0]?.event).toBe("template.deleted")
    expect(auditRows[0]?.targetEntityType).toBe("template")
  })

  test("refuses to delete a system template", async () => {
    const { softDeleteTemplate } = await import("../mutations")

    const template = await makeTemplate({ name: "Built-in", isSystem: true })

    const result = await softDeleteTemplate({ id: template.id })
    const active = await database.select().from(templates).where(isNull(templates.deletedAt))

    expect(result).toEqual({ error: "System templates cannot be deleted" })
    expect(active).toHaveLength(1)
  })

  test("confirms a template image upload by inserting the uploads row", async () => {
    const { confirmTemplateImageUpload } = await import("../mutations")

    const result = await confirmTemplateImageUpload({
      objectKey: "templates/logo.png",
      filename: "logo.png",
      contentType: "image/png",
      sizeBytes: 2048
    })
    const rows = await database.select().from(uploads)

    expect("data" in result && result.data.storageKey).toBe("templates/logo.png")
    expect(rows).toHaveLength(1)
    expect(rows[0]?.path).toBe("templates/logo.png")
  })

  test("persists an image block that references an existing upload", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "invoice", name: "Draft" })
    const upload = await makeUpload()

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [
        {
          id: "b1",
          type: "image",
          content: { source: "upload", uploadId: upload.id, alt: "Logo" },
          layout: rect(0, 0, 160, 160),
          ...flags
        }
      ],
      pageSettings
    })

    expect("data" in result).toBe(true)
  })

  test("rejects a save whose image block references a missing upload", async () => {
    const { updateTemplate } = await import("../mutations")

    const template = await makeTemplate({ type: "invoice", name: "Draft" })

    const result = await updateTemplate({
      id: template.id,
      name: "Final",
      subject: "",
      blocks: [
        {
          id: "b1",
          type: "image",
          content: {
            source: "upload",
            uploadId: "9f8ee5f8-6a37-4b18-9d3c-6a4f5f1a2b3c",
            alt: "Logo"
          },
          layout: rect(0, 0, 160, 160),
          ...flags
        }
      ],
      pageSettings
    })
    const [row] = await database.select().from(templates).where(eq(templates.id, template.id))

    expect("error" in result).toBe(true)
    expect(row?.blocks).toEqual([])
  })

  test("normalizes a legacy frameless row (original list model) into stacked rectangles on read", async () => {
    const { getTemplateForEdit } = await import("../queries")

    const template = await makeTemplate({
      type: "invoice",
      blocks: [
        { id: "h", type: "heading", content: { text: "Hi", level: 1 } },
        { id: "t", type: "text", content: { html: "<p>Body</p>" } }
      ]
    })

    const editorData = await getTemplateForEdit({ id: template.id })

    expect(editorData?.blocks.map((block) => block.id)).toEqual(["h", "t"])
    expect(editorData?.blocks[0]?.type).toBe("text")
    expect(editorData?.blocks[0]?.layout).toMatchObject({ x: 0, y: 0 })
    expect(editorData?.blocks[1]?.layout.y).toBeGreaterThan(0)
    expect(editorData?.pageSettings).toEqual(DEFAULT_PAGE_SETTINGS)
  })

  test("rewrites stored structured blocks into primitives on read", async () => {
    const { getTemplateForEdit } = await import("../queries")

    const template = await makeTemplate({
      type: "invoice",
      blocks: [
        {
          id: "head",
          type: "header",
          layout: { slot: "header", row: 0, column: 0, width: null, height: null },
          content: { title: "Invoice" }
        },
        {
          id: "items",
          type: "line_items",
          layout: { slot: "body", row: 0, column: 0, width: null, height: null },
          content: { showTax: true }
        },
        {
          id: "notes",
          type: "notes",
          layout: { slot: "body", row: 1, column: 0, width: null, height: null },
          content: { text: "Thank you" }
        }
      ]
    })

    const editorData = await getTemplateForEdit({ id: template.id })

    expect(editorData?.blocks.map((block) => ({ id: block.id, type: block.type }))).toEqual([
      { id: "head", type: "text" },
      { id: "notes", type: "text" }
    ])
  })

  test("normalizes a legacy freeform-canvas row to its frame rectangle on read", async () => {
    const { getTemplateForEdit } = await import("../queries")

    const template = await makeTemplate({
      type: "invoice",
      blocks: [
        {
          id: "lower",
          type: "text",
          content: { html: "<p>Body</p>" },
          frame: { x: 32, y: 400, width: 400, height: 96 }
        },
        {
          id: "upper",
          type: "heading",
          content: { text: "Hi", level: 1 },
          frame: { x: 32, y: 40, width: 400, height: 48 }
        }
      ]
    })

    const editorData = await getTemplateForEdit({ id: template.id })

    const upper = editorData?.blocks.find((block) => block.id === "upper")
    const lower = editorData?.blocks.find((block) => block.id === "lower")

    expect(upper?.type).toBe("text")
    expect(upper?.layout).toEqual({ x: 32, y: 40, width: 400, height: 48 })
    expect(lower?.layout).toEqual({ x: 32, y: 400, width: 400, height: 96 })
  })
})
