"use client"

import dynamic from "next/dynamic"

const AppearanceSettingsPage = dynamic(
  () =>
    import("@/features/settings/appearance/components/AppearanceSettingsPage").then(
      (module) => module.AppearanceSettingsPage
    ),
  { ssr: false }
)

export { AppearanceSettingsPage }
