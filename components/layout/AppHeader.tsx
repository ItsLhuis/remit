"use client"

import { usePathname } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  Button,
  Icon,
  SidebarTrigger
} from "@/components/ui"

const routeLabels = {
  "/": "app.navigation.dashboard",
  "/clients": "app.navigation.clients",
  "/projects": "app.navigation.projects",
  "/proposals": "app.navigation.proposals",
  "/invoices": "app.navigation.invoices",
  "/settings": "app.navigation.settings"
} as const

const getPageLabelKey = (pathname: string): (typeof routeLabels)[keyof typeof routeLabels] => {
  const exactMatch = routeLabels[pathname as keyof typeof routeLabels]
  if (exactMatch) return exactMatch

  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return "app.navigation.dashboard"

  const base = `/${segments[0]}`
  return routeLabels[base as keyof typeof routeLabels] ?? "app.navigation.dashboard"
}

const AppHeader = () => {
  const { t } = useTranslation()

  const pathname = usePathname()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="md:hidden" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{t(getPageLabelKey(pathname))}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto">
        <Button variant="ghost" size="icon">
          <Icon name="Bell" />
          <span className="sr-only">{t("app.navigation.notifications")}</span>
        </Button>
      </div>
    </header>
  )
}

export { AppHeader }
