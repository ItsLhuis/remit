"use client"

import { useTranslation } from "@/lib/i18n"

import { CopyIcon, FieldLabel, IconButton, Input } from "@/components/ui"

import { useCopyWithFeedback } from "@/hooks"

type McpCopyFieldProps = {
  id: string
  label: string
  value: string
}

// `CopyLinkField` copies the page's own origin plus a path. The address an assistant needs is the
// configured public one, which this page may not be open on, so the value is copied exactly as the
// server built it.
const McpCopyField = ({ id, label, value }: McpCopyFieldProps) => {
  const { t } = useTranslation()

  const { copied, copy } = useCopyWithFeedback()

  const copyLabel = t(copied ? "settings.mcp.copied" : "settings.mcp.copy")

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input id={id} readOnly value={value} className="font-mono" />
        <IconButton
          variant="outline"
          label={t("settings.mcp.copy")}
          tooltip={copyLabel}
          onClick={() => void copy(value)}
        >
          <CopyIcon copied={copied} />
        </IconButton>
      </div>
    </div>
  )
}

export { McpCopyField }
