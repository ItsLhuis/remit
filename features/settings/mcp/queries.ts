import { desc, eq, sql } from "drizzle-orm"

import { env } from "@/lib/config/env"

import { database } from "@/database"
import { apiTokens, auditLogs } from "@/database/schema"

import { MCP_ENDPOINT_PATH, MCP_TOOL_CALLED_EVENT } from "@/features/mcp"

import { mcpToolCallMetadataSchema } from "./schemas"
import { type McpSettingsPageData, type McpToolCallItem } from "./types"

export const MCP_TOOL_CALLS_SHOWN = 20

type McpToolCallRow = {
  id: string
  createdAt: Date
  metadata: unknown
  tokenName: string | null
  tokenPrefix: string | null
}

export async function getMcpSettingsPageData(): Promise<McpSettingsPageData> {
  const [settingsRow, toolCallRows] = await Promise.all([
    database.query.settings.findFirst({
      columns: { mcpEnabled: true, defaultLocale: true, defaultTimezone: true }
    }),
    listRecentMcpToolCalls()
  ])

  return {
    enabled: settingsRow?.mcpEnabled ?? false,
    // The public address the operator configured rather than the one this page was opened on: an
    // owner on the local network would otherwise hand an assistant an address only their LAN reaches.
    endpointUrl: `${env.REMIT_PUBLIC_URL}${MCP_ENDPOINT_PATH}`,
    toolCalls: toolCallRows.flatMap(toMcpToolCallItem),
    locale: settingsRow?.defaultLocale ?? "en",
    timeZone: settingsRow?.defaultTimezone ?? "UTC"
  }
}

// The token is joined on its id as text rather than cast to a uuid, so a row whose metadata was
// written by something else can never fail the whole read.
async function listRecentMcpToolCalls(): Promise<McpToolCallRow[]> {
  return database
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      metadata: auditLogs.metadata,
      tokenName: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix
    })
    .from(auditLogs)
    .leftJoin(apiTokens, sql`${apiTokens.id}::text = ${auditLogs.metadata} ->> 'apiTokenId'`)
    .where(eq(auditLogs.event, MCP_TOOL_CALLED_EVENT))
    .orderBy(desc(auditLogs.createdAt))
    .limit(MCP_TOOL_CALLS_SHOWN)
}

function toMcpToolCallItem(row: McpToolCallRow): McpToolCallItem[] {
  const metadata = mcpToolCallMetadataSchema.safeParse(row.metadata)

  if (!metadata.success) return []

  return [
    {
      id: row.id,
      calledAt: row.createdAt,
      tool: metadata.data.tool,
      tokenName: row.tokenName,
      tokenPrefix: row.tokenPrefix,
      outcome: metadata.data.outcome,
      resultCount: metadata.data.resultCount
    }
  ]
}
