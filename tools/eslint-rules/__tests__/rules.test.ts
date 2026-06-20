// @vitest-environment node

import { type Rule, RuleTester } from "eslint"

import tseslint from "typescript-eslint"

import { afterAll, describe, it } from "vitest"

import plugin from "../index.mjs"

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
      ecmaVersion: "latest",
      sourceType: "module"
    }
  }
})

// RuleTester drives Vitest assertions through its own describe/it; bridge it to the active runner.
const bridge = RuleTester as unknown as {
  describe: unknown
  it: unknown
  itOnly: unknown
  afterAll: unknown
}

bridge.describe = describe
bridge.it = it
bridge.itOnly = it.only
bridge.afterAll = afterAll

const rules = plugin.rules as Record<string, Rule.RuleModule>

const validateBeforeIo = rules["validate-before-io"]

ruleTester.run("validate-before-io", validateBeforeIo, {
  valid: [
    {
      name: "validation guard precedes database access",
      filename: "queries.ts",
      code: [
        "async function load(input) {",
        "  const parsed = schema.safeParse(input)",
        "  if (!parsed.success) return null",
        "  const row = await database.query.clients.findFirst()",
        "  return row",
        "}"
      ].join("\n")
    },
    {
      name: "no database access means nothing to order",
      filename: "queries.ts",
      code: [
        "async function load(input) {",
        "  const parsed = schema.safeParse(input)",
        "  if (!parsed.success) return null",
        "  return parsed.data",
        "}"
      ].join("\n")
    }
  ],
  invalid: [
    {
      name: "database access before validation is hoisted when the guard is independent",
      filename: "queries.ts",
      code: [
        "async function load(input) {",
        "  const row = await database.query.clients.findFirst()",
        "  const parsed = schema.safeParse(input)",
        "  if (!parsed.success) return null",
        "  return row",
        "}"
      ].join("\n"),
      output: [
        "async function load(input) {",
        "  const parsed = schema.safeParse(input)",
        "  if (!parsed.success) return null",
        "",
        "  const row = await database.query.clients.findFirst()",
        "",
        "  return row",
        "}"
      ].join("\n"),
      errors: [{ messageId: "ioBeforeValidation" }]
    },
    {
      name: "validation that depends on the read is reported without a fix",
      filename: "queries.ts",
      code: [
        "async function load(input) {",
        "  const key = await database.getKey()",
        "  const parsed = schema.safeParse(key)",
        "  if (!parsed.success) return null",
        "  return parsed.data",
        "}"
      ].join("\n"),
      output: null,
      errors: [{ messageId: "ioBeforeValidation" }]
    }
  ]
})
