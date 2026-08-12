import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { TeamSettingsPage } from "@/features/team/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: t("settings.metadata.team")
}

const TeamPage = async () => {
  await requireRole("owner")

  return <TeamSettingsPage />
}

export default TeamPage
