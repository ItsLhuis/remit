import { type Metadata } from "next"

import { AppearanceSettingsPage } from "./AppearancePageClient"

export const metadata: Metadata = {
  title: "Appearance"
}

export default function Page() {
  return <AppearanceSettingsPage />
}
