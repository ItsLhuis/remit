"use client"

import { useState } from "react"

import Link from "next/link"

import { usePathname } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { useScroll } from "@/hooks/useScroll"

import {
  Icon,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  ScrollArea,
  Sidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui"

type NavItem = {
  labelKey: string
  href: string
  icon: Parameters<typeof Icon>[0]["name"]
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const navGroups = [
  {
    label: "common.navigation.account",
    items: [
      { labelKey: "settings.navigation.profile", href: "/settings/profile", icon: "UserRound" },
      { labelKey: "settings.navigation.security", href: "/settings/security", icon: "ShieldCheck" },
      { labelKey: "settings.navigation.appearance", href: "/settings/appearance", icon: "Palette" }
    ]
  },
  {
    label: "settings.navigation.business",
    items: [
      { labelKey: "settings.navigation.business", href: "/settings/business", icon: "Building2" },
      { labelKey: "settings.navigation.payment", href: "/settings/payment", icon: "Landmark" }
    ]
  },
  {
    label: "settings.navigation.invoicing",
    items: [
      { labelKey: "settings.navigation.invoicing", href: "/settings/invoicing", icon: "FileText" },
      { labelKey: "settings.navigation.taxRates", href: "/settings/tax-rates", icon: "Percent" },
      {
        labelKey: "common.navigation.templates",
        href: "/settings/templates",
        icon: "LayoutTemplate"
      }
    ]
  },
  {
    label: "settings.navigation.email",
    items: [{ labelKey: "settings.navigation.email", href: "/settings/email", icon: "Mail" }]
  }
] as const satisfies readonly NavGroup[]

const SettingsSidebar = () => {
  const { t } = useTranslation()

  const pathname = usePathname()

  const { isMobile } = useSidebar()

  const [search, setSearch] = useState("")

  const { ref: viewportRef, canScrollUp, canScrollDown } = useScroll()

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        t(item.labelKey).toLowerCase().includes(search.toLowerCase())
      )
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar className="bg-background" collapsible="panel">
      <SidebarHeader>
        <InputGroup>
          <InputGroupInput
            placeholder={t("common.actions.search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <InputGroupAddon>
            <Icon name="Search" />
          </InputGroupAddon>
        </InputGroup>
      </SidebarHeader>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ScrollArea
          className="min-h-0 flex-1"
          data-slot="sidebar-content"
          data-sidebar="content"
          viewportRef={viewportRef}
        >
          {filteredGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{t(group.label)}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                      tooltip={t(item.labelKey)}
                    >
                      <Link href={item.href}>
                        <Icon name={item.icon} />
                        {t(item.labelKey)}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </ScrollArea>
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b to-transparent transition-opacity",
            isMobile ? "from-sidebar" : "from-background",
            canScrollUp ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t to-transparent transition-opacity",
            isMobile ? "from-sidebar" : "from-background",
            canScrollDown ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </Sidebar>
  )
}

export { SettingsSidebar }
