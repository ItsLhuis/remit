import { type ReactNode } from "react"

import { cookies } from "next/headers"

import { SidebarInset, SidebarProvider } from "@/components/ui"

import { AppHeader, AppSidebar } from "@/components/layout"

const DashboardLayout = async ({ children }: { children: ReactNode }) => {
  const cookieStore = await cookies()

  const sidebarState = cookieStore.get("sidebar_state")?.value
  const defaultOpen = sidebarState !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-4 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardLayout
