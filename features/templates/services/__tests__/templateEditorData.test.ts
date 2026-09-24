import { describe, expect, test } from "vitest"

import { DEFAULT_PAGE_SETTINGS } from "../canvasLayout"
import { toTemplateEditorData, type StoredTemplateRow } from "../templateEditorData"

function makeRow(overrides: Partial<StoredTemplateRow> = {}): StoredTemplateRow {
  return {
    id: "template-1",
    name: "Standard invoice",
    type: "invoice",
    subject: "Invoice {{invoice.number}}",
    blocks: [
      {
        id: "a",
        type: "text",
        layout: { x: 0, y: 0, width: 240, height: 32 },
        content: { html: "Thanks for your business" }
      }
    ],
    pageSettings: { margins: { top: 48, right: 48, bottom: 48, left: 48 } },
    isDefault: true,
    isSystem: false,
    ...overrides
  }
}

describe("toTemplateEditorData", () => {
  test("opens a stored template with its blocks, page settings and flags", () => {
    const data = toTemplateEditorData(makeRow())

    expect(data.blocks.map((block) => block.id)).toEqual(["a"])
    expect(data.pageSettings.margins.top).toBe(48)
    expect(data.pageSettings.fontFamily).toBe(DEFAULT_PAGE_SETTINGS.fontFamily)
    expect(data.subject).toBe("Invoice {{invoice.number}}")
    expect(data.isDefault).toBe(true)
  })

  test("opens as an empty canvas when the stored blocks no longer parse", () => {
    const data = toTemplateEditorData(makeRow({ blocks: [{ id: "a", type: "hologram" }] }))

    expect(data.blocks).toEqual([])
  })

  test("falls back to the default page settings when the stored ones no longer parse", () => {
    const data = toTemplateEditorData(makeRow({ pageSettings: { margins: "wide" } }))

    expect(data.pageSettings).toEqual(DEFAULT_PAGE_SETTINGS)
  })

  test("treats a template with no subject as an empty subject line", () => {
    const data = toTemplateEditorData(makeRow({ subject: null }))

    expect(data.subject).toBe("")
  })
})
