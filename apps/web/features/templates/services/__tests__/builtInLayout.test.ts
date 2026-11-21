import { describe, expect, test } from "vitest"

import { blocksSchema, templatePageSettingsSchema, type Block } from "../../schemas"
import {
  buildBuiltInLayout,
  BUILT_IN_LAYOUT_TYPES,
  type BuiltInLayoutLabels,
  type BuiltInLayoutType
} from "../builtInLayout"
import { validateLayout } from "../canvasLayout"
import { extractMergeTokens, MERGE_VARIABLES, type TemplateRenderData } from "../mergeVariables"
import { renderTemplate } from "../renderTemplate"

const LABELS: BuiltInLayoutLabels = {
  invoiceTitle: "Invoice",
  proposalTitle: "Proposal",
  creditNoteTitle: "Credit note",
  billTo: "Bill to",
  preparedFor: "Prepared for",
  issueDate: "Issue date",
  dueDate: "Due date",
  validUntil: "Valid until",
  issued: "Issued",
  correctsInvoice: "Corrects invoice",
  amountDue: "Amount due",
  proposalTotal: "Total",
  creditTotal: "Total credited",
  description: "Description",
  quantity: "Qty",
  unitPrice: "Unit price",
  tax: "Tax",
  amount: "Amount",
  subtotal: "Subtotal",
  discount: "Discount",
  lateFee: "Late fee",
  total: "Total",
  amountPaid: "Paid",
  credited: "Credited",
  payment: "Payment details",
  bank: "Bank",
  iban: "IBAN",
  notes: "Notes",
  reason: "Reason"
}

// Every whitelisted variable of the type carries a value, the way the render-data builders fill
// them, so a test can remove one to see the layout drop the line it feeds.
function makeRenderData(type: BuiltInLayoutType, lineItemCount = 2): TemplateRenderData {
  const values = Object.fromEntries(
    MERGE_VARIABLES[type].map((variable) => [variable, `<${variable}>`])
  )

  return {
    values,
    lineItems: Array.from({ length: lineItemCount }, (_, index) => ({
      "lineItem.description": `Line ${index + 1}`,
      "lineItem.quantity": "1",
      "lineItem.unitPrice": "€10.00",
      "lineItem.taxPercentage": "23%",
      "lineItem.total": "€12.30"
    }))
  }
}

function build(type: BuiltInLayoutType, renderData = makeRenderData(type), omit: string[] = []) {
  return buildBuiltInLayout({ type, renderData, labels: LABELS, omit })
}

function render(type: BuiltInLayoutType, renderData = makeRenderData(type), omit: string[] = []) {
  const layout = build(type, renderData, omit)

  return renderTemplate({
    blocks: layout.blocks,
    renderData,
    type,
    format: "html",
    pageSettings: layout.pageSettings
  })
}

function bottomOf(blocks: readonly Block[]): number {
  return Math.max(...blocks.map((block) => block.layout.y + block.layout.height))
}

describe("buildBuiltInLayout", () => {
  test.each(BUILT_IN_LAYOUT_TYPES)(
    "produces a %s layout the block schema and the canvas bounds accept",
    (type) => {
      const layout = build(type)

      expect(blocksSchema.safeParse(layout.blocks).success).toBe(true)
      expect(templatePageSettingsSchema.safeParse(layout.pageSettings).success).toBe(true)
      expect(validateLayout(layout.blocks, layout.pageSettings, type)).toEqual({ valid: true })
    }
  )

  test("places the invoice figures a client pays from, late fee and credits included", () => {
    const tokens = extractMergeTokens(build("invoice").blocks)

    expect(tokens).toEqual(
      expect.arrayContaining([
        "invoice.number",
        "invoice.issueDate",
        "invoice.dueDate",
        "invoice.total",
        "invoice.lateFee",
        "invoice.credited",
        "invoice.amountPaid",
        "invoice.amountDue",
        "payment.iban",
        "payment.instructions",
        "client.name"
      ])
    )
  })

  test("names the invoice a credit note corrects", () => {
    expect(extractMergeTokens(build("credit_note").blocks)).toEqual(
      expect.arrayContaining(["creditNote.number", "creditNote.invoiceNumber", "creditNote.total"])
    )
  })

  test("leaves out a late fee line when no fee has been charged", () => {
    const renderData = makeRenderData("invoice")

    renderData.values["invoice.lateFee"] = ""

    expect(extractMergeTokens(build("invoice", renderData).blocks)).not.toContain("invoice.lateFee")
  })

  test("leaves out the lines the caller marks as zero", () => {
    const tokens = extractMergeTokens(
      build("invoice", makeRenderData("invoice"), ["invoice.discount", "invoice.amountPaid"]).blocks
    )

    expect(tokens).not.toContain("invoice.discount")
    expect(tokens).not.toContain("invoice.amountPaid")
    expect(tokens).toContain("invoice.amountDue")
  })

  test("uses only the proposal's own variables on a proposal", () => {
    const tokens = extractMergeTokens(build("proposal").blocks)

    expect(tokens.every((token) => (MERGE_VARIABLES.proposal as string[]).includes(token))).toBe(
      true
    )
  })

  test("grows the page with the line items so the totals never overlap the table", () => {
    const short = build("invoice", makeRenderData("invoice", 1))
    const long = build("invoice", makeRenderData("invoice", 30))

    const table = long.blocks.find((block) => block.type === "table")
    const totals = long.blocks.find((block) => block.id === "builtin-totals")

    expect(bottomOf(long.blocks)).toBeGreaterThan(bottomOf(short.blocks))
    expect(totals?.layout.y ?? 0).toBeGreaterThanOrEqual(
      (table?.layout.y ?? 0) + (table?.layout.height ?? 0)
    )
  })

  test("allows more height for a description that wraps", () => {
    const renderData = makeRenderData("invoice", 1)
    const wrapped = makeRenderData("invoice", 1)

    wrapped.lineItems = [{ ...wrapped.lineItems?.[0], "lineItem.description": "x ".repeat(200) }]

    const tableOf = (data: TemplateRenderData) =>
      build("invoice", data).blocks.find((block) => block.type === "table")?.layout.height ?? 0

    expect(tableOf(wrapped)).toBeGreaterThan(tableOf(renderData))
  })

  test("escapes the translated labels it writes into the document", () => {
    const layout = buildBuiltInLayout({
      type: "invoice",
      renderData: makeRenderData("invoice"),
      labels: { ...LABELS, billTo: "Bill <b>to</b>" },
      omit: []
    })

    expect(JSON.stringify(layout.blocks)).toContain("Bill &lt;b&gt;to&lt;/b&gt;")
  })

  test("renders through the template renderer with every token resolved", () => {
    const html = render("invoice")

    expect(html).not.toMatch(/\{\{/)
    expect(html).toContain("&lt;invoice.amountDue&gt;")
    expect(html).toContain("Line 2")
  })
})
