import { type ReactNode } from "react"

import { cookies } from "next/headers"

import { SidebarInset, SidebarProvider } from "@/components/ui"

import { AppHeader, AppSidebar } from "@/components/layout"

const DashboardLayout = async ({ children }: { children: ReactNode }) => {
  const cookieStore = await cookies()

  const sidebarState = cookieStore.get("sidebar_state")?.value
  const defaultOpen = sidebarState !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardLayout
