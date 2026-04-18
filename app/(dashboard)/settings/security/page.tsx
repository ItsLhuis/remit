import { type Metadata } from "next"

import { SecuritySettingsPage } from "@/features/settings/security/components"

export const metadata: Metadata = {
  title: "Security - Settings"
}

const SecurityPage = () => {
  return <SecuritySettingsPage />
}

export default SecurityPage
