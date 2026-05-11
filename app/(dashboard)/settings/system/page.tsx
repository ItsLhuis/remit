import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { getHealthChecks } from "@/features/health/server"

import { HealthDashboard } from "@/features/health"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: t("settings.metadata.system")
}

const SystemSettingsPage = async () => {
  await requireRole("owner")

  const checks = await getHealthChecks()

  return <HealthDashboard checks={checks} />
}

export default SystemSettingsPage
