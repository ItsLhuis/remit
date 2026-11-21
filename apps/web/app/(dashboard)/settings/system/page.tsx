import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { HealthSettingsPage } from "@/features/health"
import { getHealthChecks, getSystemInfo } from "@/features/health/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: t("settings.metadata.system")
}

const SystemSettingsPage = async () => {
  await requireRole("owner")

  const checks = await getHealthChecks()
  const systemInfo = getSystemInfo()

  return <HealthSettingsPage checks={checks} systemInfo={systemInfo} />
}

export default SystemSettingsPage
