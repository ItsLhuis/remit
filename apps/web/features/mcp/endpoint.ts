// The two names the MCP server shares with its settings page. They live in a module that imports
// nothing because `/settings/mcp` (features/settings/mcp/queries.ts) needs them and must not load the
// server's own graph, which reaches back into `features/settings` through the invoices feature.
export const MCP_ENDPOINT_PATH = "/api/mcp"

export const MCP_TOOL_CALLED_EVENT = "mcp.tool.called"
