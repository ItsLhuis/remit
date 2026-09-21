"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icon,
  Typography
} from "@/components/ui"

import { McpCopyField } from "./McpCopyField"

type McpConnectionCardProps = {
  endpointUrl: string
}

// The token appears as a placeholder and never as a value: it was shown once, on the API settings
// page, and nothing here can read it back.
function toClaudeCodeCommand(endpointUrl: string): string {
  return `claude mcp add --transport http remit ${endpointUrl} --header "Authorization: Bearer <your API token>"`
}

const McpConnectionCard = ({ endpointUrl }: McpConnectionCardProps) => {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.mcp.connectionTitle")}</CardTitle>
        <CardDescription>{t("settings.mcp.connectionDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex max-w-3xl flex-col gap-5">
        <McpCopyField
          id="mcp-endpoint"
          label={t("settings.mcp.endpointLabel")}
          value={endpointUrl}
        />
        <div className="flex flex-col items-start gap-2">
          <Typography affects="small">{t("settings.mcp.tokenStep")}</Typography>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/api">
              <Icon name="KeyRound" aria-hidden="true" />
              {t("settings.mcp.openApiSettings")}
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <McpCopyField
            id="mcp-claude-code-command"
            label={t("settings.mcp.commandLabel")}
            value={toClaudeCodeCommand(endpointUrl)}
          />
          <Typography affects={["small", "muted"]}>{t("settings.mcp.headerStep")}</Typography>
        </div>
      </CardContent>
    </Card>
  )
}

export { McpConnectionCard }
