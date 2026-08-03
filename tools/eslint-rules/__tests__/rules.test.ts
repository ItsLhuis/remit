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

const noHookInComponents = rules["no-hook-in-components"]

ruleTester.run("no-hook-in-components", noHookInComponents, {
  valid: [
    {
      name: "a component under components/ is what the folder is for",
      filename: "features/leads/components/LeadCard.tsx",
      code: "export const LeadCard = () => null"
    },
    {
      name: "a module-private contract under components/ exports no hook",
      filename: "features/templates/components/TemplateEditorPage/layerDropId.ts",
      code: "export function encodeLayerDropId(id) {\n  return `layer:${id}`\n}"
    },
    {
      name: "a hook declared in hooks/ is outside the rule's scope",
      filename: "features/templates/hooks/useEditorHotkeys.ts",
      code: "export function useEditorHotkeys() {}"
    },
    {
      name: "a test helper under components/ is exempt",
      filename: "features/templates/components/__tests__/canvasHarness.tsx",
      code: "export function useHarness() {}"
    },
    {
      name: "an unexported hook-shaped local is not a public hook",
      filename: "features/leads/components/LeadCard.tsx",
      code: "function useLocal() {}\n\nexport const LeadCard = () => null"
    },
    {
      name: "a lowercase `use` prefix is an ordinary function",
      filename: "features/leads/components/LeadCard.tsx",
      code: "export function useraName() {}"
    },
    {
      name: "a re-export names a function this file cannot see",
      filename: "features/leads/components/index.ts",
      code: 'export { useSomething } from "./elsewhere"'
    }
  ],
  invalid: [
    {
      name: "a hook declared with `function` under components/ belongs in hooks/",
      filename: "features/templates/components/TemplateEditorPage/useEditorHotkeys.ts",
      code: "export function useEditorHotkeys() {}",
      errors: [{ messageId: "hookInComponents", data: { name: "useEditorHotkeys" } }]
    },
    {
      name: "a hook assigned to a const under components/ belongs in hooks/",
      filename: "features/leads/components/useLeadFilters.ts",
      code: "export const useLeadFilters = () => ({})",
      errors: [{ messageId: "hookInComponents", data: { name: "useLeadFilters" } }]
    },
    {
      name: "a hook exported through a bottom export block belongs in hooks/",
      filename: "features/leads/components/LeadCard.tsx",
      code: "function useLeadCard() {}\n\nexport { useLeadCard }",
      errors: [{ messageId: "hookInComponents", data: { name: "useLeadCard" } }]
    }
  ]
})

const hookFileExportsItsHook = rules["hook-file-exports-its-hook"]

ruleTester.run("hook-file-exports-its-hook", hookFileExportsItsHook, {
  valid: [
    {
      name: "a use* file exporting its hook as a function declaration",
      filename: "features/templates/hooks/useEditorHotkeys.ts",
      code: "export function useEditorHotkeys() {}"
    },
    {
      name: "a use* file exporting its hook through a bottom export block",
      filename: "hooks/useIsMobile.ts",
      code: "function useIsMobile() {}\n\nexport { useIsMobile }"
    },
    {
      name: "a non-use basename is a private helper co-located with its consumer",
      filename: "features/templates/hooks/selectionActions.ts",
      code: "export function createSelectionActions() {}"
    },
    {
      name: "the barrel is not a hook file",
      filename: "features/templates/hooks/index.ts",
      code: 'export * from "./useEditorHotkeys"'
    },
    {
      name: "a hook test is exempt",
      filename: "features/templates/hooks/__tests__/useEditorHotkeys.test.ts",
      code: "test('it', () => {})"
    },
    {
      name: "a file outside hooks/ is outside the rule's scope",
      filename: "features/templates/services/useless.ts",
      code: "export const value = 1"
    }
  ],
  invalid: [
    {
      name: "a use* file exporting a differently named hook",
      filename: "features/templates/hooks/useEditorHotkeys.ts",
      code: "export function useEditorShortcuts() {}",
      errors: [{ messageId: "missingHook", data: { basename: "useEditorHotkeys" } }]
    },
    {
      name: "a use* file exporting no function at all",
      filename: "features/templates/hooks/useSnapBypass.ts",
      code: "export const SNAP_BYPASS_KEY = 'Alt'",
      errors: [{ messageId: "missingHook", data: { basename: "useSnapBypass" } }]
    },
    {
      name: "a use* file that declares its hook but never exports it",
      filename: "hooks/useIsMobile.ts",
      code: "function useIsMobile() {}\n\nexport const value = 1",
      errors: [{ messageId: "missingHook", data: { basename: "useIsMobile" } }]
    }
  ]
})

const noUnnamedUseWatch = rules["no-unnamed-use-watch"]

ruleTester.run("no-unnamed-use-watch", noUnnamedUseWatch, {
  valid: [
    {
      name: "a single named field",
      filename: "features/proposals/components/ProposalForm/ProposalDetailsFields.tsx",
      code: 'const kind = useWatch({ control, name: "discountKind" })'
    },
    {
      name: "a named field list",
      filename: "features/proposals/components/ProposalForm/ProposalPricingSection.tsx",
      code: 'const [currency, items] = useWatch({ control, name: ["currency", "lineItems"] })'
    },
    {
      name: "a spread that could carry name is not guessed at",
      filename: "features/proposals/components/ProposalForm/ProposalPricingSection.tsx",
      code: "const value = useWatch({ ...options })"
    },
    {
      name: "a test file is exempt",
      filename: "features/proposals/components/ProposalForm/__tests__/ProposalForm.test.tsx",
      code: "const watched = useWatch({ control })"
    }
  ],
  invalid: [
    {
      name: "control alone subscribes to every field",
      filename: "features/proposals/components/ProposalForm/ProposalForm.tsx",
      code: "const watched = useWatch({ control: form.control })",
      errors: [{ messageId: "unnamedUseWatch" }]
    },
    {
      name: "no argument at all subscribes to every field",
      filename: "features/invoices/components/InvoiceForm/InvoiceForm.tsx",
      code: "const watched = useWatch()",
      errors: [{ messageId: "unnamedUseWatch" }]
    }
  ]
})
