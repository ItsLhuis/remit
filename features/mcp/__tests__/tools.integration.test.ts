import { expect, test } from "vitest"

import { z } from "zod"

import { apiOperations } from "@/features/api/server"

import { INVOICE_VIEW_STATUS_VALUES } from "@/features/invoices"

import { MCP_INVOICE_STATUSES } from "../schemas"
import { FREE_TEXT_TOOL_ARGUMENTS } from "../services/toolAudit"
import { MCP_TOOLS } from "../tools"

const jsonSchemaNodeSchema = z.looseObject({
  type: z.union([z.string(), z.array(z.string())]).optional(),
  format: z.string().optional(),
  enum: z.array(z.unknown()).optional(),
  items: z.unknown().optional()
})

type JsonSchemaNode = z.infer<typeof jsonSchemaNodeSchema>

// A property's own node, or its items' node when it is an array of values.
function readArgumentNode(value: unknown): JsonSchemaNode | null {
  const node = jsonSchemaNodeSchema.safeParse(value)

  if (!node.success) return null

  const items = jsonSchemaNodeSchema.safeParse(node.data.items)

  return items.success ? items.data : node.data
}

// A string argument the audit trail may record verbatim: an id, a calendar day, or one of a fixed
// set of values. Anything else is free text and must be named in FREE_TEXT_TOOL_ARGUMENTS, which is
// the list `toAuditArguments` reduces to "a search was made".
function isRecordableString(node: JsonSchemaNode): boolean {
  return node.format === "uuid" || node.format === "date" || Array.isArray(node.enum)
}

function isString(node: JsonSchemaNode): boolean {
  return node.type === "string" || (Array.isArray(node.type) && node.type.includes("string"))
}

test("every tool mirrors one REST operation, taking its resource and its response schema", () => {
  const operations: Record<string, { resource: string | null; response: unknown }> = apiOperations

  const mismatched = MCP_TOOLS.filter((tool) => {
    const operation = operations[tool.operationId]

    return operation?.resource !== tool.resource || operation.response !== tool.outputSchema
  })

  expect(MCP_TOOLS.length).toBeGreaterThan(0)
  expect(mismatched.map((tool) => tool.name)).toEqual([])
})

test("tool names are unique and use only the characters the specification recommends", () => {
  const names = MCP_TOOLS.map((tool) => tool.name)

  expect(new Set(names).size).toBe(names.length)
  expect(names.every((name) => /^[A-Za-z0-9_.-]{1,128}$/.test(name))).toBe(true)
})

test("no tool takes a free-text argument the audit trail would record verbatim", () => {
  const unguarded = MCP_TOOLS.flatMap((tool) => {
    const schema = z.toJSONSchema(tool.inputSchema, { io: "input" })

    return Object.entries(schema.properties ?? {}).flatMap(([name, property]) => {
      const node = readArgumentNode(property)

      if (!node || !isString(node) || isRecordableString(node)) return []

      return (FREE_TEXT_TOOL_ARGUMENTS as readonly string[]).includes(name)
        ? []
        : [`${tool.name}.${name}`]
    })
  })

  expect(unguarded).toEqual([])
})

test("the invoice states a tool accepts are the invoices feature's own", () => {
  expect([...MCP_INVOICE_STATUSES].toSorted()).toEqual([...INVOICE_VIEW_STATUS_VALUES].toSorted())
})
