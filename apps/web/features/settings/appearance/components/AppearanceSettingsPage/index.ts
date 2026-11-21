"use client"

import dynamic from "next/dynamic"

const AppearanceSettingsPage = dynamic(
  () =>
    import("./AppearanceSettingsPage").then((module) => ({
      default: module.AppearanceSettingsPage
    })),
  { ssr: false }
)

export { AppearanceSettingsPage }
