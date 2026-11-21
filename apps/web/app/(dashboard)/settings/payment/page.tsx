import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { PaymentSettingsPage } from "@/features/settings/server"

export const metadata: Metadata = {
  title: t("settings.metadata.payment")
}

const PaymentSettingsRoute = async () => {
  await requireRole("owner")

  return <PaymentSettingsPage />
}

export default PaymentSettingsRoute
