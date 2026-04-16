import { type ReactNode } from "react"

import { cookies } from "next/headers"

import { ScrollArea, SidebarProvider } from "@/components/ui"

import { SettingsSidebar } from "./SettingsSidebar"

type SettingsLayoutProps = {
  children: ReactNode
}

const SettingsLayout = async ({ children }: SettingsLayoutProps) => {
  const cookieStore = await cookies()

  const sidebarState = cookieStore.get("settings_sidebar_state")?.value
  const defaultOpen = sidebarState !== "false"

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      cookieName="settings_sidebar_state"
      style={{ "--sidebar-width": "12rem", minHeight: 0 } as React.CSSProperties}
      className="flex-1"
    >
      <SettingsSidebar />
      <ScrollArea className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl">{children}</div>
      </ScrollArea>
    </SidebarProvider>
  )
}

export default SettingsLayout
