import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { McpSettingsPage } from "@/features/settings/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: t("settings.metadata.mcp")
}

const McpSettingsRoute = async () => {
  await requireRole("owner")

  return <McpSettingsPage />
}

export default McpSettingsRoute
