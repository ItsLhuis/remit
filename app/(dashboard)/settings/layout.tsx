import { type ReactNode } from "react"

import { cookies, headers } from "next/headers"

import { getCurrentRole, requireSession } from "@/lib/auth/session"

import { ScrollArea, SidebarProvider } from "@/components/ui"

import { SettingsSidebar } from "@/components/layout"

type SettingsLayoutProps = {
  children: ReactNode
}

const SettingsLayout = async ({ children }: SettingsLayoutProps) => {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])

  const sidebarState = cookieStore.get("settings_sidebar_state")?.value
  const defaultOpen = sidebarState !== "false"
  const session = await requireSession(requestHeaders)
  // Drives navigation visibility only, never authorization: `settings/system/page.tsx` and
  // `settings/team/page.tsx` call `requireRole("owner")` themselves, so typing either URL is
  // refused even for a role whose rail never showed the link. Dropping a page's own check because
  // the link is hidden here opens the route.
  const role = await getCurrentRole({
    headers: requestHeaders,
    userId: session.user.id
  })

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      cookieName="settings_sidebar_state"
      style={{ "--sidebar-width": "12rem", minHeight: 0 } as React.CSSProperties}
      className="flex-1"
    >
      <SettingsSidebar showOwnerSections={role === "owner"} />
      <ScrollArea className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl">{children}</div>
      </ScrollArea>
    </SidebarProvider>
  )
}

export default SettingsLayout
