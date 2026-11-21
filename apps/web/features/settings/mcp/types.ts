export type McpToolCallOutcome = "returned" | "not_found" | "failed"

// A tool call as the owner sees it: what was asked and how it ended, never what came back. The
// audit entry it is read from holds no returned rows to show.
export type McpToolCallItem = {
  id: string
  calledAt: Date
  tool: string
  tokenName: string | null
  tokenPrefix: string | null
  outcome: McpToolCallOutcome
  resultCount: number
}

export type McpSettingsPageData = {
  enabled: boolean
  endpointUrl: string
  toolCalls: McpToolCallItem[]
  locale: string
  timeZone: string
}
