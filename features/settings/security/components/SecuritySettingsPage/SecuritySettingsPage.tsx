"use client"

import { SidebarTrigger, Typography } from "@/components/ui"

import { TwoFactorSection } from "./TwoFactorSection"

const SecuritySettingsPage = () => (
  <div className="flex flex-col gap-8 p-4 md:p-8">
    <header className="flex items-center gap-2">
      <SidebarTrigger className="md:hidden" />
      <Typography variant="h2">Security</Typography>
    </header>
    <div className="space-y-8">
      <TwoFactorSection />
    </div>
  </div>
)

export { SecuritySettingsPage }
