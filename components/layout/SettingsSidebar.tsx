"use client"

import { useState } from "react"

import { usePathname } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

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
  Typography
} from "@/components/ui"

import { useScroll } from "@/hooks"

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
      { labelKey: "settings.navigation.taxRates", href: "/settings/tax-rates", icon: "Percent" }
    ]
  },
  {
    label: "settings.navigation.email",
    items: [{ labelKey: "settings.navigation.email", href: "/settings/email", icon: "Mail" }]
  },
  {
    label: "settings.navigation.system",
    items: [
      {
        labelKey: "settings.navigation.system",
        href: "/settings/system",
        icon: "Activity"
      }
    ]
  }
] as const satisfies readonly NavGroup[]

type SettingsSidebarProps = {
  showSystem: boolean
}

const SettingsSidebar = ({ showSystem }: SettingsSidebarProps) => {
  const { t } = useTranslation()

  const pathname = usePathname()

  const [search, setSearch] = useState("")

  const { ref: viewportRef, canScrollUp, canScrollDown } = useScroll()

  const visibleGroups = showSystem
    ? navGroups
    : navGroups.filter((group) => group.label !== "settings.navigation.system")

  const filteredGroups = visibleGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        t(item.labelKey).toLowerCase().includes(search.toLowerCase())
      )
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible="panel">
      <SidebarHeader className="flex h-14 justify-center">
        <div className="px-1 text-start">
          <Typography variant="h4">{t("app.navigation.settings")}</Typography>
        </div>
      </SidebarHeader>
      <div className="mt-2 px-2 pb-2">
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
      </div>
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
            "from-sidebar pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b to-transparent transition-opacity",
            canScrollUp ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "from-sidebar pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t to-transparent transition-opacity",
            canScrollDown ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </Sidebar>
  )
}

export { SettingsSidebar }
