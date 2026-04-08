"use client"

import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  Button,
  Icon,
  SidebarTrigger
} from "@/components/ui"

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/clients": "Clients",
  "/projects": "Projects",
  "/proposals": "Proposals",
  "/invoices": "Invoices",
  "/settings": "Settings"
}

const getPageLabel = (pathname: string): string => {
  if (routeLabels[pathname]) return routeLabels[pathname]

  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return "Dashboard"

  const base = `/${segments[0]}`
  return routeLabels[base] ?? segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
}

const AppHeader = () => {
  const pathname = usePathname()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="md:hidden" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{getPageLabel(pathname)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto">
        <Button variant="ghost" size="icon">
          <Icon name="Bell" />
          <span className="sr-only">Notifications</span>
        </Button>
      </div>
    </header>
  )
}

export { AppHeader }
