import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { EmailSettingsPage } from "@/features/settings/server"

export const metadata: Metadata = {
  title: t("settings.metadata.email")
}

const EmailSettingsRoute = async () => {
  const { session } = await requireRole("owner")

  return <EmailSettingsPage defaultTestRecipient={session.user.email} />
}

export default EmailSettingsRoute
