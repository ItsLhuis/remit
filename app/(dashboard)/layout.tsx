import { type ReactNode } from "react"

import { cookies } from "next/headers"

import { SidebarInset, SidebarProvider } from "@/components/ui"

import { AppSidebar } from "@/components/layout"

import { getUnreadActivityCount } from "@/features/activityLog/server"

const DashboardLayout = async ({ children }: { children: ReactNode }) => {
  const [cookieStore, unreadActivityCount] = await Promise.all([
    cookies(),
    getUnreadActivityCount()
  ])

  // A presentation preference, not routing state, so it does not fall under the no-cookie rule in
  // `security.md` and ADR-0001 — that rule governs which route a user is sent to, and `proxy.ts`
  // still derives every such decision from the database and the session alone. The value is written
  // client-side by `components/ui/Sidebar.tsx` and read back here so the first server render opens
  // the sidebar the user left open instead of flashing to the default.
  const sidebarState = cookieStore.get("sidebar_state")?.value
  const defaultOpen = sidebarState !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="h-svh overflow-hidden">
      <AppSidebar unreadActivityCount={unreadActivityCount} />
      <SidebarInset className="min-w-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardLayout
