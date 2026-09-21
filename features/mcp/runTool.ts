import { type CallToolResult } from "@modelcontextprotocol/server"

import { type z } from "zod"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { MCP_TOOL_CALLED_EVENT } from "./endpoint"
import { toAuditArguments } from "./services/toolAudit"
import { type McpSession } from "./session"

export type McpAuditTarget = {
  entityType: "client" | "project" | "invoice"
  entityId: string
}

export type McpToolCall = {
  tool: string
  // The REST operation's response schema. Every result is parsed through it on the way out, so a
  // tool publishes exactly the fields `features/api/responseSchemas.ts` names for the same resource,
  // and a read model that grows a note, a token or a storage key cannot reach an assistant.
  response: z.ZodObject
  arguments: Readonly<Record<string, unknown>>
  target: McpAuditTarget | null
}

export type McpToolRead = { found: true; payload: unknown; resultCount: number } | { found: false }

type SettledToolCall = {
  result: CallToolResult
  outcome: "returned" | "not_found" | "failed"
  resultCount: number
}

export async function runMcpTool(
  session: McpSession,
  call: McpToolCall,
  read: () => Promise<McpToolRead>
): Promise<CallToolResult> {
  const settled = await settleToolCall(session, call, read)

  // One entry per call, answering "what did the assistant do" and never "what did it read": the
  // arguments go through `toAuditArguments`, and the rows the call returned are counted, not kept.
  await writeAudit(MCP_TOOL_CALLED_EVENT, {
    actorUserId: session.userId,
    actorRole: session.role,
    targetEntityType: call.target?.entityType ?? null,
    targetEntityId: call.target?.entityId ?? null,
    metadata: {
      apiTokenId: session.tokenId,
      tool: call.tool,
      arguments: toAuditArguments(call.arguments),
      outcome: settled.outcome,
      resultCount: settled.resultCount
    },
    ipAddress: session.ipAddress,
    userAgent: session.userAgent
  })

  return settled.result
}

async function settleToolCall(
  session: McpSession,
  call: McpToolCall,
  read: () => Promise<McpToolRead>
): Promise<SettledToolCall> {
  try {
    const record = await read()

    if (!record.found) {
      return { result: toolError(t("errors.notFound")), outcome: "not_found", resultCount: 0 }
    }

    const structuredContent = call.response.parse(record.payload)

    return {
      result: {
        content: [{ type: "text", text: JSON.stringify(structuredContent) }],
        structuredContent
      },
      outcome: "returned",
      resultCount: record.resultCount
    }
  } catch (error) {
    // The raw error stays in the instance log. It may be a driver error quoting a column value, or a
    // Zod issue naming a field a serialiser tried to publish, and a tool result is read by a model
    // whose provider keeps it.
    logger.error(
      { action: `mcp.${call.tool}`, apiTokenId: session.tokenId, err: error },
      "MCP tool call failed"
    )

    return { result: toolError(t("errors.somethingWentWrong")), outcome: "failed", resultCount: 0 }
  }
}

export function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true }
}
