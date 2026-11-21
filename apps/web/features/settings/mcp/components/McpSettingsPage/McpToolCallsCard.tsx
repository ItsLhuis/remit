import { t } from "@/lib/i18n/server"

import { formatDate } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  Icon,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui"

import { MCP_TOOL_CALLS_SHOWN } from "../../queries"
import { type McpToolCallItem } from "../../types"

type McpToolCallsCardProps = {
  toolCalls: McpToolCallItem[]
  locale: string
  timeZone: string
}

function formatOutcome(toolCall: McpToolCallItem): string {
  switch (toolCall.outcome) {
    case "returned":
      return t("settings.mcp.outcome.returned", { count: toolCall.resultCount })
    case "not_found":
      return t("settings.mcp.outcome.notFound")
    case "failed":
      return t("settings.mcp.outcome.failed")
  }
}

function formatToken(toolCall: McpToolCallItem): string {
  if (!toolCall.tokenName) return t("settings.mcp.unknownToken")

  return `${toolCall.tokenName} (${toolCall.tokenPrefix ?? ""}...)`
}

const McpToolCallsCard = ({ toolCalls, locale, timeZone }: McpToolCallsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.mcp.activityTitle")}</CardTitle>
        <CardDescription>
          {t("settings.mcp.activityDescription", { count: MCP_TOOL_CALLS_SHOWN })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {toolCalls.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="Bot" />
              </EmptyMedia>
              <EmptyDescription>{t("settings.mcp.activityEmpty")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableCaption className="sr-only">{t("settings.mcp.activityTitle")}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("settings.mcp.tableWhen")}</TableHead>
                <TableHead>{t("settings.mcp.tableTool")}</TableHead>
                <TableHead>{t("settings.mcp.tableToken")}</TableHead>
                <TableHead>{t("settings.mcp.tableOutcome")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {toolCalls.map((toolCall) => (
                <TableRow key={toolCall.id}>
                  <TableCell className="tabular-nums">
                    {formatDate(toolCall.calledAt, { locale, timeZone })}
                  </TableCell>
                  <TableCell className="font-mono">{toolCall.tool}</TableCell>
                  <TableCell>{formatToken(toolCall)}</TableCell>
                  <TableCell>{formatOutcome(toolCall)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export { McpToolCallsCard }
