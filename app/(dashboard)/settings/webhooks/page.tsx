import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { WebhookSettingsPage } from "@/features/settings/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: t("settings.metadata.webhooks")
}

const WebhookSettingsRoute = async () => {
  await requireRole("owner")

  return <WebhookSettingsPage />
}

export default WebhookSettingsRoute
