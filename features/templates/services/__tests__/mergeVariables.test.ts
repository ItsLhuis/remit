import { describe, expect, test } from "vitest"

import { LINE_ITEM_FIELD_LABEL_KEYS, MERGE_VARIABLE_LABEL_KEYS } from "../../labels"
import { LINE_ITEM_FIELDS, type Block } from "../../schemas"
import { createBlock } from "../blocks"
import { getContentBounds, DEFAULT_PAGE_SETTINGS } from "../canvasLayout"
import {
  buildSampleRenderData,
  extractMergeTokens,
  findUnknownTokens,
  getMergeVariables,
  ALL_MERGE_VARIABLES,
  MERGE_VARIABLES
} from "../mergeVariables"

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function textBlock(html: string): Block {
  const block = createBlock("text", bounds)

  return block.type === "text" ? { ...block, content: { html } } : block
}

function tableBlock(header: string, cell: string): Block {
  const block = createBlock("table", bounds)

  if (block.type !== "table") return block

  return {
    ...block,
    content: {
      source: "manual",
      columns: [{ id: "c1", header, width: null, binding: null }],
      rows: [{ id: "r1", cells: [cell] }]
    }
  }
}

function frameWithText(html: string): Block {
  const frame = createBlock("frame", bounds)
  const child = createBlock("text", bounds)

  if (frame.type !== "frame" || child.type !== "text") return frame

  return {
    ...frame,
    content: {
      ...frame.content,
      children: [{ ...child, content: { html }, layout: { ...child.layout, x: 0, y: 0 } }]
    }
  }
}

describe("extractMergeTokens", () => {
  test("collects unique tokens from text html, table headers, and manual cells", () => {
    const blocks: Block[] = [
      textBlock("Dear {{client.name}}, total {{invoice.total}} and again {{client.name}}"),
      tableBlock("Invoice {{invoice.number}}", "{{invoice.subtotal}}"),
      createBlock("image", bounds)
    ]

    const tokens = extractMergeTokens(blocks)

    expect(tokens.toSorted()).toEqual([
      "client.name",
      "invoice.number",
      "invoice.subtotal",
      "invoice.total"
    ])
  })

  test("collects tokens from text blocks nested inside a frame", () => {
    const blocks = [frameWithText("{{business.name}}")]

    expect(extractMergeTokens(blocks)).toEqual(["business.name"])
  })
})

describe("findUnknownTokens", () => {
  test("flags identifiers outside the template type's whitelist", () => {
    const blocks = [textBlock("{{invoice.total}} {{secret.apiKey}}")]

    expect(findUnknownTokens(blocks, "invoice")).toEqual(["secret.apiKey"])
  })

  test("flags a hand-typed token in a table cell that is not on this type", () => {
    const blocks = [tableBlock("Amount", "{{proposal.total}}")]

    expect(findUnknownTokens(blocks, "invoice")).toEqual(["proposal.total"])
  })

  test("flags removed identifiers that no longer resolve to a column", () => {
    const blocks = [textBlock("{{payment.accountName}} {{client.address}}")]

    expect(findUnknownTokens(blocks, "invoice").toSorted()).toEqual([
      "client.address",
      "payment.accountName"
    ])
  })
})

describe("whitelist data", () => {
  test("every identifier in every whitelist carries a human-readable label key", () => {
    for (const identifier of ALL_MERGE_VARIABLES) {
      expect(MERGE_VARIABLE_LABEL_KEYS[identifier]).toMatch(/^templates\.mergeVariables\.labels\./)
    }

    for (const identifiers of Object.values(MERGE_VARIABLES)) {
      for (const identifier of identifiers) {
        expect(MERGE_VARIABLE_LABEL_KEYS[identifier]).toBeDefined()
      }
    }
  })

  test("every line-item binding carries a label key", () => {
    for (const field of LINE_ITEM_FIELDS) {
      expect(LINE_ITEM_FIELD_LABEL_KEYS[field]).toMatch(/^templates\.mergeVariables\.labels\./)
    }
  })

  test("payment identifiers exist only on invoice and credit note", () => {
    expect(getMergeVariables("invoice")).toContain("payment.iban")
    expect(getMergeVariables("credit_note")).toContain("payment.iban")
    expect(getMergeVariables("proposal")).not.toContain("payment.iban")
    expect(getMergeVariables("contract")).not.toContain("payment.iban")
  })

  test("contract dates use the effective-from/until columns", () => {
    const contract = getMergeVariables("contract")

    expect(contract).toContain("contract.effectiveFrom")
    expect(contract).toContain("contract.effectiveUntil")
  })

  test("line-item fields never appear as scalar page identifiers", () => {
    for (const identifiers of Object.values(MERGE_VARIABLES)) {
      for (const identifier of identifiers) {
        expect(identifier.startsWith("lineItem.")).toBe(false)
      }
    }
  })
})

describe("buildSampleRenderData", () => {
  test("brackets every whitelisted identifier for the template type", () => {
    const data = buildSampleRenderData("invoice")

    expect(data.values["invoice.total"]).toBe("[invoice.total]")
    expect(Object.keys(data.values)).toHaveLength(getMergeVariables("invoice").length)
  })

  test("supplies representative sample line-item rows for table previews", () => {
    const data = buildSampleRenderData("invoice")

    expect(data.lineItems).toHaveLength(3)
    expect(data.lineItems?.[0]?.["lineItem.description"]).toBe("[lineItem.description]")
  })
})
