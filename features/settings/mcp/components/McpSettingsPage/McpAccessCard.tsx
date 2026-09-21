"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Icon,
  Spinner,
  Typography,
  toast
} from "@/components/ui"

import { setMcpEnabled } from "../../mutations"

type McpAccessCardProps = {
  enabled: boolean
}

// The statement is the consent, so it stays on the card rather than behind a dialog: the owner reads
// it before turning the server on, and can read it again at any time while it is on.
const CONSENT_STATEMENTS = [
  { icon: "BookOpen", key: "settings.mcp.consentReads" },
  { icon: "Send", key: "settings.mcp.consentLeaves" },
  { icon: "ShieldCheck", key: "settings.mcp.consentNever" },
  { icon: "Lock", key: "settings.mcp.consentReadOnly" },
  { icon: "Power", key: "settings.mcp.consentOff" }
] as const

const McpAccessCard = ({ enabled: initialEnabled }: McpAccessCardProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [enabled, setEnabled] = useState(initialEnabled)

  const [isSaving, startSaving] = useTransition()

  const handleToggle = () => {
    const next = !enabled

    startSaving(async () => {
      const result = await setMcpEnabled({ enabled: next })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setEnabled(result.data.enabled)

      toast.success(t(result.data.enabled ? "settings.mcp.turnedOn" : "settings.mcp.turnedOff"))

      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.mcp.accessTitle")}</CardTitle>
        <CardDescription>{t("settings.mcp.accessDescription")}</CardDescription>
        <CardAction>
          <Badge variant={enabled ? "success" : "secondary"}>
            <Icon name={enabled ? "CircleCheck" : "CircleOff"} aria-hidden="true" />
            {t(enabled ? "settings.mcp.statusOn" : "settings.mcp.statusOff")}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="flex max-w-prose flex-col gap-3">
          {CONSENT_STATEMENTS.map((statement) => (
            <li key={statement.key} className="flex gap-3">
              <Icon
                name={statement.icon}
                className="text-muted-foreground mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <Typography affects="small">{t(statement.key)}</Typography>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Typography affects={["small", "muted"]} aria-live="polite">
          {t(enabled ? "settings.mcp.onSummary" : "settings.mcp.offSummary")}
        </Typography>
        <Button
          type="button"
          size="sm"
          variant={enabled ? "outline" : "default"}
          disabled={isSaving}
          onClick={handleToggle}
        >
          {isSaving && <Spinner />}
          {t(enabled ? "settings.mcp.turnOff" : "settings.mcp.turnOn")}
        </Button>
      </CardFooter>
    </Card>
  )
}

export { McpAccessCard }
