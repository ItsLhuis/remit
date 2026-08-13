import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { DataSettingsPage } from "@/features/dataExport/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: t("settings.metadata.data")
}

const DataPage = async () => {
  await requireRole("owner")

  return <DataSettingsPage />
}

export default DataPage
