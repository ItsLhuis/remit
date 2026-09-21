import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

export const setMcpEnabledSchema = z.object({
  enabled: z.boolean(i18n.t("settings.mcp.validation.enabledInvalid"))
})

// The metadata `features/mcp/runTool.ts` writes on every `mcp.tool.called` entry, read back from an
// untyped `jsonb` column. A row that does not match is left off the page rather than trusted: its
// messages are never shown, so none of them needs translating.
export const mcpToolCallMetadataSchema = z.object({
  apiTokenId: z.string(),
  tool: z.string(),
  outcome: z.enum(["returned", "not_found", "failed"]),
  resultCount: z.number().int().nonnegative()
})
